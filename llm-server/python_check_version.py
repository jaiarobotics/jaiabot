import importlib
import pkg_resources

# List of packages you want to check
packages = [
    "fastapi",
    "pytesseract",
    "uvicorn",
    "langchain",
    "langchain_community",
    "chromadb",
    "pydantic",
    "watchdog",
    "unstructured",
]

print("\n📦 Package Version Report\n" + "-" * 40)

for pkg in packages:
    try:
        version = pkg_resources.get_distribution(pkg.replace("_", "-")).version
        print(f"{pkg:<25} {version}")
    except Exception:
        try:
            module = importlib.import_module(pkg)
            version = getattr(module, "__version__", "unknown")
            print(f"{pkg:<25} {version}")
        except ImportError:
            print(f"{pkg:<25} ❌ not installed")

print("\n✅ Version check complete.\n")
