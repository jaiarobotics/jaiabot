from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
# FIX 1: Import modern LangChain components for the chain
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.chat_models import ChatOllama
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
import asyncio # Needed to run synchronous tasks in the background

# NOTE: Assuming 'rag/retriever.py' now returns an LCEL-compatible BaseRetriever
from rag.retriever import get_retriever 
# FIX 2: Removed 'from rag.ollama_client import query_model'

# --- RAG Chain Definition ---

# 1. Initialize the Model (Use the standard LangChain class for Ollama)
# Assuming 'gemma3:12b-it-qat' is running via Ollama
llm = ChatOllama(model="gemma3:12b-it-qat") 

# 2. Define the Prompt Template
SYSTEM_TEMPLATE = """
You are an intelligent chat assistant for the jaiabot system docs. Use the following context to answer the user's question. Give in-depth answers in easy to understand language.
Be concise. If you don't know the answer based on the context, state clearly that the information is not available in the documents.

CONTEXT:
{context}

QUESTION:
{question}
"""
prompt = ChatPromptTemplate.from_template(SYSTEM_TEMPLATE)

# 3. Document Formatting function for the chain
def format_docs(docs):
    """Formats the list of documents into a single string for the context key."""
    return "\n\n".join(doc.page_content for doc in docs)

# 4. Define the RAG Chain using LCEL
retriever_instance = get_retriever()

# FIX 3: Define the entire RAG flow as one chain
rag_chain = (
    # Maps input 'query' to keys needed by the prompt
    {
        "context": retriever_instance | format_docs, # Runs retriever, pipes docs to formatter
        "question": RunnablePassthrough()            # Passes the original query through
    }
    | prompt          # Creates the final formatted prompt
    | llm             # Passes the prompt to the LLM for generation
    | StrOutputParser() # Extracts the final text answer
)

# --- FastAPI App Setup ---

app = FastAPI(title="RAG Server with Ollama (LCEL)")

templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {
        "request": request, 
        "answer": None, 
        "rebuilding": retriever_instance.rebuilding
    })

# --- The Fixed Endpoint ---

@app.post("/", response_class=HTMLResponse)
async def ask_question(request: Request, query: str = Form(...)):
    # ... (rag_chain.ainvoke call to get the answer)
    answer = await rag_chain.ainvoke(query)

    # 2. Retrieve documents to get the sources.
    # FIX: Use .ainvoke() which is the correct public async method.
    docs = await retriever_instance.ainvoke(query)
    sources = [d.metadata.get("source", "unknown") for d in docs]

    return templates.TemplateResponse("index.html", {
        "request": request,
        "query": query,
        "answer": answer,
        "sources": sources,
        "rebuilding": retriever_instance.rebuilding
    })