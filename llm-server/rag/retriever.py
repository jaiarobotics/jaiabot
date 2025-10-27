import os
import threading
import hashlib
import asyncio
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from typing import List, Set, Dict, Any

from pydantic import Field
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from langchain_community.document_loaders import DirectoryLoader, UnstructuredFileLoader
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from pdf2image import convert_from_path
from PIL import Image
import pytesseract


# ---------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------
DB_DIR = "chroma_db"
DATA_DIR = (Path.home() / "jaiabot/src/doc").resolve()
MAX_WORKERS = 16
CHUNK_SIZE = 500
CHUNK_OVERLAP = 200


# ---------------------------------------------------------------------
# UTILITIES
# ---------------------------------------------------------------------
def file_hash(path: str) -> str:
    """Return MD5 hash of a file (used for change detection)."""
    try:
        with open(path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()
    except Exception:
        return None


# ---------------------------------------------------------------------
# CUSTOM LOADER WITH OCR FALLBACK
# ---------------------------------------------------------------------
class SafeUnstructuredLoader(UnstructuredFileLoader):
    """Enhanced file loader:
    - Skips doxygen files
    - Falls back to OCR for scanned PDFs and images
    """

    def lazy_load(self):
        path = str(self.file_path)
        if "doxygen" in path.lower():
            print(f"⚠ Skipping doxygen file {path}")
            return

        if path.lower().endswith(".pdf"):
            yield from self._load_pdf(path)
        elif path.lower().endswith((".png", ".jpg", ".jpeg")):
            yield from self._load_image(path)
        else:
            yield from self._load_default(path)

    def _load_pdf(self, path: str):
        """Try parsing PDF; fallback to OCR if no extractable text."""
        try:
            elements = list(self._get_elements())
            if not elements or all(not (getattr(el, "text", str(el)).strip()) for el in elements):
                print(f"⚡ No text in {path}, running OCR fallback...")
                text = self._ocr_pdf(path)
                if text.strip():
                    yield Document(page_content=text, metadata={"source": path})
            else:
                for el in elements:
                    text = getattr(el, "text", None) or str(el)
                    if text.strip():
                        yield Document(page_content=text, metadata={"source": path})
        except Exception as e:
            print(f"⚠ Failed to process PDF {path}: {e}")

    def _load_image(self, path: str):
        """Perform OCR extraction for image files."""
        try:
            text = pytesseract.image_to_string(Image.open(path))
            if text.strip():
                yield Document(page_content=text, metadata={"source": path})
        except Exception as e:
            print(f"⚠ OCR failed for {path}: {e}")

    def _load_default(self, path: str):
        """Default text extraction for general files."""
        try:
            for el in self._get_elements():
                text = getattr(el, "text", None) or str(el)
                if text.strip():
                    yield Document(page_content=text, metadata={"source": path})
        except Exception as e:
            print(f"⚠ Failed to load file {path}: {e}")

    def _ocr_pdf(self, path: str) -> str:
        """OCR-extract text from a scanned PDF."""
        text = ""
        try:
            for i, page in enumerate(convert_from_path(path, dpi=150), 1):
                try:
                    text += pytesseract.image_to_string(page) + "\n"
                except Exception as e:
                    print(f"⚠ OCR failed on page {i} of {path}: {e}")
        except Exception as e:
            print(f"⚠ Failed to convert {path} to images: {e}")
        return text


# ---------------------------------------------------------------------
# RETRIEVER IMPLEMENTATION
# ---------------------------------------------------------------------
class Retriever(BaseRetriever):
    embeddings: OllamaEmbeddings = Field(default_factory=lambda: OllamaEmbeddings(model="mxbai-embed-large"))
    db: Any = Field(default=None)
    retriever: Any = Field(default=None)
    lock: threading.Lock = Field(default_factory=threading.Lock)
    rebuilding: bool = Field(default=False)
    loaded_files: Set[str] = Field(default_factory=set)
    file_index: Dict[str, str] = Field(default_factory=dict)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._build_db(initial=True)
        self._start_watcher()

    # -----------------------------------------------------------------
    # CORE BUILD LOGIC
    # -----------------------------------------------------------------
    def _process_file(self, doc: Document):
        """Return valid Document or None."""
        src = doc.metadata.get("source", "")
        if doc.page_content.strip():
            return [doc]
        print(f"⚠ Empty document: {src}")
        return None

    def _build_db(self, initial=False, changed_files=None):
        with self.lock:
            self.rebuilding = True
            print("⚡ Building retriever..." if initial else "⚡ Updating retriever...")

            loader = DirectoryLoader(
                DATA_DIR,
                glob="**/*",
                recursive=True,
                loader_cls=SafeUnstructuredLoader,
                show_progress=True,
                silent_errors=True,
            )

            docs = []
            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
                for result in ex.map(self._process_file, loader.load()):
                    if result:
                        docs.extend(result)

            # Filter incremental updates
            if changed_files:
                docs = [d for d in docs if d.metadata.get("source") in changed_files]

            if not docs:
                print(f"ℹ No {'new' if not initial else ''} documents found.")
                self.rebuilding = False
                return

            splitter = RecursiveCharacterTextSplitter(
                chunk_size=CHUNK_SIZE,
                chunk_overlap=CHUNK_OVERLAP,
                length_function=len,
            )
            docs = splitter.split_documents(docs)

            if not os.path.exists(DB_DIR) or initial:
                self.db = Chroma.from_documents(
                    docs,
                    self.embeddings,
                    persist_directory=DB_DIR,
                    collection_metadata={"hnsw:space": "cosine"},
                )
            else:
                self.db = Chroma(persist_directory=DB_DIR, embedding_function=self.embeddings)
                self.db.add_documents(docs, batch_size=64)

            self.db.persist()

            for d in docs:
                src = d.metadata.get("source", "")
                self.loaded_files.add(src)
                self.file_index[src] = file_hash(src)

            self.retriever = self.db.as_retriever(
                search_type="mmr",
                search_kwargs={
                    "k": 20,          # number of results returned after MMR reranking
                    "fetch_k": 80,    # how many to fetch before reranking (larger = more diversity)
                    "lambda_mult": 0.5,  # 0.5 = balance between relevance and diversity
                },
            )


            print(f"✅ Retriever ready — {len(self.loaded_files)} documents indexed")
            self.rebuilding = False

    # -----------------------------------------------------------------
    # FILE SYSTEM WATCHER
    # -----------------------------------------------------------------
    def _start_watcher(self):
        """Continuously monitor for file changes and rebuild as needed."""

        class Handler(FileSystemEventHandler):
            def __init__(self, retriever_instance):
                self.retriever_instance = retriever_instance

            def on_any_event(self, event):
                if event.is_directory:
                    return
                changed = event.src_path
                h = file_hash(changed)
                if h and self.retriever_instance.file_index.get(changed) != h:
                    print(f"⚡ Detected change in {changed}, rebuilding...")
                    self.retriever_instance._build_db(changed_files={changed})

        observer = Observer()
        observer.schedule(Handler(self), str(DATA_DIR), recursive=True)
        observer.daemon = True
        observer.start()

    # -----------------------------------------------------------------
    # RETRIEVAL INTERFACE
    # -----------------------------------------------------------------
    def _get_relevant_documents(self, query: str) -> List[Document]:
        return self.get_relevant_documents(query)

    async def _aget_relevant_documents(self, query: str) -> List[Document]:
        return await asyncio.to_thread(self.get_relevant_documents, query)

    def get_relevant_documents(self, query: str, per_doc_limit: int = 3, k: int = 20) -> List[Document]:
        """
        Retrieve top-k documents with diversity: limit how many chunks come from each source document.

        Args:
            query: The query string.
            per_doc_limit: Maximum number of chunks to include from any single document.
            k: Number of top results to request from the retriever before filtering.

        Returns:
            A list of documents with balanced source representation.
        """
        with self.lock:
            if not self.retriever:
                print("⚠ Retriever not ready yet")
                return []

            # Ask Chroma for more chunks than we plan to keep
            raw_results = self.retriever.invoke(query, search_kwargs={"k": k * 2})

            # Group results by their source file
            grouped: Dict[str, List[Document]] = {}
            for doc in raw_results:
                src = doc.metadata.get("source", "unknown")
                grouped.setdefault(src, []).append(doc)

            # Sort chunks within each document by their retrieval order
            for docs in grouped.values():
                docs.sort(key=lambda d: raw_results.index(d))

            # Interleave results: pick up to per_doc_limit from each doc in round-robin fashion
            final: List[Document] = []
            round_index = 0
            while len(final) < k:
                added_this_round = False
                for src, docs in grouped.items():
                    if round_index < len(docs) and len([d for d in final if d.metadata.get("source") == src]) < per_doc_limit:
                        final.append(docs[round_index])
                        if len(final) >= k:
                            break
                        added_this_round = True
                if not added_this_round:
                    break
                round_index += 1

            return final


    def get_loaded_files(self) -> List[str]:
        return sorted(self.loaded_files)


# ---------------------------------------------------------------------
# SINGLETON ACCESSOR
# ---------------------------------------------------------------------
retriever = Retriever()


def get_retriever():
    return retriever
