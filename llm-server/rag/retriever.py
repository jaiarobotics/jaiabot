import os
import sys
from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings

# --- Configuration ---
# Adjust this path if your folder is named differently
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(CURRENT_DIR, "../faiss_index")

MODEL_NAME = "nomic-embed-text"
BASE_URL = "http://localhost:11434"

def get_retriever():
    """
    Loads the pre-existing FAISS index from disk.
    Assumes 'build_faiss.py' has already been run.
    """

    # 1. Verification
    if not os.path.exists(DB_PATH):
        print(f"\nCRITICAL ERROR: FAISS index not found at: {DB_PATH}")
        print("   Please run your build script (e.g., 'python build_faiss.py') to create it first.\n")
        sys.exit(1)

    # 2. Initialize Embeddings
    # (Must be the exact same model used when building the DB)
    embeddings = OllamaEmbeddings(
        model=MODEL_NAME,
        base_url=BASE_URL
    )

    # 3. Load FAISS Index
    # 'allow_dangerous_deserialization' is required for local files but safe here
    print(f"Loading FAISS index from '{DB_PATH}'...")
    try:
        vector_store = FAISS.load_local(
            DB_PATH,
            embeddings,
            allow_dangerous_deserialization=True
        )
        print("Index loaded successfully.")
    except Exception as e:
        print(f"Error loading index: {e}")
        sys.exit(1)

    # 4. Return as Retriever
    # Retrieve the top k most relevant chunks
    return vector_store.as_retriever(search_kwargs={"k": 10})

# Optional: Test run if executed directly
if __name__ == "__main__":
    try:
        r = get_retriever()
        print("Retriever is ready.")
    except Exception as e:
        print(f"Failed: {e}")