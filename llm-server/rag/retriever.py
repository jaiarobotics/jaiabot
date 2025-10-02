import os
import threading
import hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from langchain_community.document_loaders import DirectoryLoader, UnstructuredFileLoader
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import OllamaEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from pdf2image import convert_from_path
from langchain_core.documents import Document
from PIL import Image
import pytesseract

DB_DIR = "chroma_db"
DATA_DIR = Path.home() / "jaiabot/src/doc"
DATA_DIR = DATA_DIR.resolve()


def file_hash(path):
    """Return MD5 hash of a file (used for incremental updates)."""
    try:
        with open(path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()
    except Exception:
        return None


class SafeUnstructuredLoader(UnstructuredFileLoader):
    """Enhanced loader:
    - Skips doxygen files
    - Falls back to OCR for scanned PDFs and images
    """

    def lazy_load(self):
        file_path = str(self.file_path)

        # Skip doxygen folder entirely
        if "doxygen" in file_path.lower():
            print(f"⚠ Skipping doxygen file {file_path}")
            return

        # OCR fallback for PDFs
        if file_path.lower().endswith(".pdf"):
            try:
                elements = list(self._get_elements())
                if not elements or all((getattr(el, "text", "") or str(el)).strip() == "" for el in elements):
                    print(f"⚡ No text in {file_path}, trying OCR...")
                    text = self._ocr_pdf(file_path)
                    if text.strip():
                        yield Document(page_content=text, metadata={"source": file_path})
                    return
                else:
                    for el in elements:
                        text = getattr(el, "text", None) or str(el) or ""
                        if text.strip():
                            yield Document(page_content=text, metadata={"source": file_path})
            except Exception as e:
                print(f"⚠ Failed to process PDF {file_path}: {e}")
            return

        # OCR for images
        if file_path.lower().endswith((".png", ".jpg", ".jpeg")):
            try:
                text = pytesseract.image_to_string(Image.open(file_path))
                if text.strip():
                    yield Document(page_content=text, metadata={"source": file_path})
            except Exception as e:
                print(f"⚠ OCR failed for {file_path}: {e}")
            return

        # Default extraction for other files
        try:
            for element in self._get_elements():
                text = getattr(element, "text", None) or str(element) or ""
                if text.strip():
                    yield Document(page_content=text, metadata={"source": file_path})
        except Exception as e:
            print(f"⚠ Failed to load file {file_path}: {e}")

    def _ocr_pdf(self, path):
        """Convert PDF pages to images and extract text with OCR."""
        text = ""
        try:
            pages = convert_from_path(path, dpi=150)  # lower DPI for speed
            for i, page in enumerate(pages, 1):
                try:
                    text += pytesseract.image_to_string(page) + "\n"
                except Exception as e:
                    print(f"⚠ OCR failed on page {i} of {path}: {e}")
        except Exception as e:
            print(f"⚠ Failed to convert {path} to images: {e}")
        return text


class Retriever:
    def __init__(self):
        self.embeddings = OllamaEmbeddings(model="mxbai-embed-large")
        self.lock = threading.Lock()
        self.rebuilding = False
        self.loaded_files = set()  # enforce uniqueness
        self.file_index = {}  # track file hashes
        self._build_db(initial=True)
        self._start_watcher()

    def _process_file(self, doc):
        """Return cleaned Document(s) or None on failure."""
        try:
            source = doc.metadata.get("source", "")
            if doc.page_content and doc.page_content.strip():
                return [doc]
            else:
                print(f"⚠ Empty doc {source}")
                return None
        except Exception as e:
            print(f"⚠ Failed to process {doc}: {e}")
            return None

    def _build_db(self, initial=False, changed_files=None):
        with self.lock:
            self.rebuilding = True
            if initial:
                print("⚡ Initial build of retriever...")
            else:
                print("⚡ Updating retriever with changed files...")

            loader = DirectoryLoader(
                DATA_DIR,
                glob="**/*",
                recursive=True,
                loader_cls=SafeUnstructuredLoader,
                show_progress=True,
                silent_errors=True,
            )

            docs = []
            # --- parallelize file processing
            with ThreadPoolExecutor(max_workers=8) as ex:
                results = list(ex.map(self._process_file, loader.load()))

            for r in results:
                if r:
                    docs.extend(r)

            # Filter for changed files if incremental update
            if changed_files is not None:
                docs = [d for d in docs if d.metadata.get("source") in changed_files]

            # ✅ Apply chunking
            if docs:
                splitter = RecursiveCharacterTextSplitter(
                    chunk_size=1000,
                    chunk_overlap=200,
                    length_function=len,
                )
                new_docs = []
                for d in docs:
                    for chunk in splitter.split_text(d.page_content):
                        new_docs.append(Document(page_content=chunk, metadata=d.metadata))
                docs = new_docs

            if not docs:
                if initial:
                    print(f"⚠ No valid documents found in {DATA_DIR}")
                else:
                    print("ℹ No new/changed documents to update")
            else:
                if not os.path.exists(DB_DIR) or initial:
                    self.db = Chroma.from_documents(
                        docs,
                        self.embeddings,
                        persist_directory=DB_DIR,
                        collection_metadata={"hnsw:space": "cosine"},
                    )
                    self.db.persist()
                else:
                    self.db = Chroma(persist_directory=DB_DIR, embedding_function=self.embeddings)
                    self.db.add_documents(docs, batch_size=64)
                    self.db.persist()

                for d in docs:
                    src = d.metadata.get("source", "")
                    self.loaded_files.add(src)
                    self.file_index[src] = file_hash(src)

                self.retriever = self.db.as_retriever(search_kwargs={"k": 20})
                print(f"✅ Retriever ready — {len(self.loaded_files)} unique documents indexed")
                print("📂 Loaded documents:")
                for f in sorted(self.loaded_files):
                    print("   -", f)

            self.rebuilding = False

    def _start_watcher(self):
        class Handler(FileSystemEventHandler):
            def __init__(self, retriever_instance):
                self.retriever_instance = retriever_instance

            def on_any_event(self, event):
                if not event.is_directory:
                    changed = event.src_path
                    h = file_hash(changed)
                    if h and self.retriever_instance.file_index.get(changed) != h:
                        print(f"⚡ Detected change in {changed}, updating retriever...")
                        self.retriever_instance._build_db(changed_files={changed})

        observer = Observer()
        observer.schedule(Handler(self), str(DATA_DIR), recursive=True)
        observer.daemon = True
        observer.start()

    def get_relevant_documents(self, query):
        with self.lock:
            if hasattr(self, "retriever"):
                return self.retriever.get_relevant_documents(query)
            else:
                print("⚠ Retriever not ready yet")
                return []

    def get_loaded_files(self):
        return sorted(self.loaded_files)


# Global instance
retriever = Retriever()


def get_retriever():
    return retriever
