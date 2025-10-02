from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from rag.retriever import get_retriever
from rag.ollama_client import query_model

app = FastAPI(title="RAG Server with Ollama")

templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

retriever_instance = get_retriever()

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {
        "request": request, 
        "answer": None, 
        "rebuilding": retriever_instance.rebuilding
    })

@app.post("/", response_class=HTMLResponse)
async def ask_question(request: Request, query: str = Form(...)):
    docs = retriever_instance.get_relevant_documents(query)
    context = "\n".join([d.page_content for d in docs])
    answer = query_model(query, context, model="gemma3:12b-it-qat")
    sources = [d.metadata.get("source", "unknown") for d in docs]
    return templates.TemplateResponse("index.html", {
        "request": request,
        "query": query,
        "answer": answer,
        "sources": sources,
        "rebuilding": retriever_instance.rebuilding
    })
