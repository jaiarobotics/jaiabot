import time
import json
import os
import asyncio
import httpx
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from langchain_core.output_parsers import StrOutputParser
from rag.retriever import get_retriever

# --- Configuration ---
MODEL_NAME = "ministral-3:3b"
OLLAMA_URL = "http://localhost:11434"

# CHANGED: We set the standard timeout to "2m" (2 minutes).
# If our heartbeat script crashes, the model auto-unloads after 2 mins.
llm = ChatOllama(model=MODEL_NAME, base_url=OLLAMA_URL, keep_alive="2m")
retriever_instance = get_retriever()

SYSTEM_TEMPLATE = """
You are an intelligent chat assistant for the jaiabot system.
Answer the question based ONLY on the following context.
If you don't know, say so.

CONTEXT:
{context}

QUESTION:
{question}
"""

prompt = ChatPromptTemplate.from_template(SYSTEM_TEMPLATE)
generation_chain = prompt | llm | StrOutputParser()

# --- Global State ---
active_socket: WebSocket | None = None
heartbeat_task: asyncio.Task | None = None # Track the heartbeat

# --- Helper: Safe Background Wake Up ---
async def trigger_wake_up():
    print(f"--- STARTUP: Waking up {MODEL_NAME} ---")
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": MODEL_NAME,
                    "prompt": "",
                    "keep_alive": "2m", # Set initial timer to 2 minutes
                    "stream": False
                },
                timeout=120
            )
            print("--- STARTUP: Model loaded successfully! ---")

    except Exception as e:
        print(f"\n--- ⚠️ Model Load Failed: {type(e).__name__} ---")
        traceback.print_exc()

async def maintain_model_heartbeat():
    """
    The 'Dead Man's Switch'.
    Runs every 60 seconds to tell Ollama 'I am still here'.
    """
    print("--- Heartbeat: Started. Keeping model in memory... ---")
    while True:
        try:
            # We sleep for 60s (half of the 2m timeout)
            await asyncio.sleep(60)

            async with httpx.AsyncClient() as client:
                # Sending an empty prompt with keep_alive refreshes the timer
                await client.post(
                    f"{OLLAMA_URL}/api/generate",
                    json={"model": MODEL_NAME, "keep_alive": "2m", "prompt": ""}
                )
                # Optional: print dot to show it's working
                # print(".", end="", flush=True)
        except asyncio.CancelledError:
            print("--- Heartbeat: Stopped. ---")
            break
        except Exception:
            # If Ollama is down, just wait and try again
            pass

async def unload_model():
    print("--- SHUTDOWN: Unloading model immediately... ---")
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": MODEL_NAME, "keep_alive": 0}
            )
            print("--- Model unloaded from VRAM ---")
    except Exception:
        pass

# --- LIFESPAN MANAGER ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. STARTUP
    # Start loading the model
    asyncio.create_task(trigger_wake_up())
    # Start the heartbeat to keep it loaded
    global heartbeat_task
    heartbeat_task = asyncio.create_task(maintain_model_heartbeat())

    yield

    # 2. SHUTDOWN (Ctrl+C)
    if heartbeat_task:
        heartbeat_task.cancel()
    await unload_model()

app = FastAPI(title="JaiaBot AI", lifespan=lifespan)
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- Model Loading Logic (Client Side Check) ---
async def ensure_model_loaded(websocket: WebSocket):
    async with httpx.AsyncClient() as client:
        start_time = time.time()
        while True:
            try:
                resp = await client.get(f"{OLLAMA_URL}/api/ps")
                data = resp.json()
                BASE_MODEL = MODEL_NAME.split(":")[0]
                if any(BASE_MODEL == m["name"].split(":")[0] for m in data.get("models", [])):
                    break
                elapsed = int(time.time() - start_time)
                await websocket.send_json({"type": "status", "msg": f"Waiting for Model Startup... ({elapsed}s)"})
                await asyncio.sleep(1.0)

                if elapsed > 300:
                    await websocket.send_json({"type": "error", "msg": "Model load timed out."})
                    return
            except Exception:
                await asyncio.sleep(1)

        await websocket.send_json({"type": "status", "msg": "Model Ready."})

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

# --- Generation Task ---
async def generate_response_task(websocket: WebSocket, query: str):
    try:
        await websocket.send_json({"type": "status", "msg": "Searching Knowledge Base..."})
        docs = await retriever_instance.ainvoke(query)
        context = format_docs(docs)
        sources = list(set([d.metadata.get("source", "Unknown") for d in docs]))

        await websocket.send_json({"type": "sources", "data": sources})
        await websocket.send_json({"type": "status", "msg": "Generating answer..."})

        async for chunk in generation_chain.astream({"context": context, "question": query}):
            await websocket.send_json({"type": "token", "msg": chunk})

        await websocket.send_json({"type": "end", "msg": ""})

    except asyncio.CancelledError:
        print(f"--- Task Cancelled for: {query[:20]}... ---")
        await websocket.send_json({"type": "status", "msg": "Stopped by user."})
        await websocket.send_json({"type": "end", "msg": ""})
    except Exception as e:
        print(f"Error in generation: {e}")
        traceback.print_exc()
        await websocket.send_json({"type": "error", "msg": str(e)})
        await websocket.send_json({"type": "end", "msg": ""})

# --- Routes ---
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/get_source")
async def get_source_content(source: str = Query(...)):
    try:
        if os.path.exists(source):
            with open(source, "r", errors="ignore") as f:
                return JSONResponse({"content": f.read()})
        return JSONResponse({"content": "File not found."})
    except Exception as e:
        return JSONResponse({"content": str(e)}, status_code=500)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, force: bool = Query(False)):
    global active_socket
    await websocket.accept()

    if active_socket is not None:
        try:
            if not force:
                await websocket.send_json({"type": "error", "msg": "BUSY"})
                await websocket.close(code=4000)
                return
            else:
                await active_socket.send_json({"type": "error", "msg": "DISPLACED"})
                await active_socket.close(code=4001)
                active_socket = None
        except Exception:
            active_socket = None

    active_socket = websocket
    print("--- 🔌 Client Connected. ---")
    current_task: asyncio.Task | None = None

    try:
        await ensure_model_loaded(websocket)

        while True:
            data = await websocket.receive_text()
            if data == "STOP_GENERATION":
                if current_task and not current_task.done():
                    current_task.cancel()
                    try: await current_task
                    except asyncio.CancelledError: pass
                continue

            query = data.strip()
            if current_task and not current_task.done():
                current_task.cancel()

            current_task = asyncio.create_task(generate_response_task(websocket, query))

    except WebSocketDisconnect:
        if active_socket == websocket:
            print("--- 🔌 Client Disconnected. ---")
            active_socket = None
            if current_task: current_task.cancel()
    except Exception as e:
        print(f"--- ⚠️ Unexpected Error: {e} ---")
        if active_socket == websocket:
             active_socket = None