import os
import shutil
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

DATA_PATH = "../src/doc_clean"
DB_PATH = "faiss_index"
MODEL_NAME = "nomic-embed-text"

def build_faiss_index():
    print(f"📂 Loading documents from '{DATA_PATH}'...")
    loader = DirectoryLoader(DATA_PATH, glob="*.md", loader_cls=TextLoader)
    raw_docs = loader.load()

    print("Splitting markdown into chunks...")

    markdown_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=[("#", "H1"), ("##", "H2"), ("###", "H3")]
    )

    recursive_splitter = RecursiveCharacterTextSplitter(
        chunk_size=256,
        chunk_overlap=32
    )

    final_chunks = []

    for doc in raw_docs:
        # MarkdownHeaderTextSplitter already returns Documents
        md_docs = markdown_splitter.split_text(doc.page_content)

        # Merge original metadata into markdown metadata
        for d in md_docs:
            d.metadata = {**doc.metadata, **d.metadata}

        # Further split into fixed-size chunks
        final_chunks.extend(recursive_splitter.split_documents(md_docs))

    print(f"Total chunks: {len(final_chunks)}")

    embeddings = OllamaEmbeddings(
        model=MODEL_NAME,
        base_url="http://localhost:11434"
    )

    print("Embedding all documents in one call...")
    #texts = [doc.page_content for doc in final_chunks]
    #vectors = embeddings.embed_documents(texts)

    print("Building FAISS index...")
    vector_store = FAISS.from_documents(final_chunks,embeddings)

    if os.path.exists(DB_PATH):
        shutil.rmtree(DB_PATH)

    vector_store.save_local(DB_PATH)
    print("Done")

if __name__ == "__main__":
    build_faiss_index()