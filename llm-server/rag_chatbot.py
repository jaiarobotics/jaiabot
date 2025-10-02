import os
from typing import List
from fastapi import FastAPI
from pydantic import BaseModel
import ollama

from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import OllamaEmbeddings

# -----------------------------
# 1. Load & Embed Documents
# -----------------------------
DATA_PATH = "./docs"
DB_PATH = "./vectorstore"

def load_vectorstore():
    if os.path.exists(DB_PATH):
        return FAISS.load_local(
            DB_PATH,
            OllamaEmbeddings(model="nomic-embed-text"),
            allow_dangerous_deserialization=True
        )

    # Load documents from folder
    loader = DirectoryLoader(DATA_PATH, glob="*.txt", loader_cls=TextLoader)
    documents = loader.load()

    # Split into chunks
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = splitter.split_documents(documents)

    # Build embeddings
    embeddings = OllamaEmbeddings(model="nomic-embed-text")

    # Store in FAISS
    vectordb = FAISS.from_documents(chunks, embeddings)
    vectordb.save_local(DB_PATH)
    return vectordb

vectordb = load_vectorstore()

# -----------------------------
# 2. FastAPI Setup
# -----------------------------
app = FastAPI(title="RAG with Ollama", version="1.0")

class QueryRequest(BaseModel):
    question: str
    k: int = 3

class QueryResponse(BaseModel):
    answer: str
    sources: List[str]

# -----------------------------
# 3. Query Endpoint
# -----------------------------
@app.post("/query", response_model=QueryResponse)
def query_docs(req: QueryRequest):
    retriever = vectordb.as_retriever(search_kwargs={"k": req.k})
    docs = retriever.get_relevant_documents(req.question)

    # Combine retrieved docs
    context = "\n\n".join([d.page_content for d in docs])
    prompt = f"Use the following context to answer:\n\n{context}\n\nQuestion: {req.question}\nAnswer:"

    # Query Ollama model
    response = ollama.chat(model="llama3", messages=[{"role": "user", "content": prompt}])
    answer = response["message"]["content"]

    sources = [d.metadata.get("source", "unknown") for d in docs]

    return QueryResponse(answer=answer, sources=sources)

