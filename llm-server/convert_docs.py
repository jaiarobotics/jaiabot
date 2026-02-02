import os
import pymupdf4llm

SOURCE_DIR = "../src/doc"
DEST_DIR = "../src/doc_clean"

if not os.path.exists(DEST_DIR):
    os.makedirs(DEST_DIR)

print(f"--- Starting Markdown Conversion from {SOURCE_DIR} ---")

files = [f for f in os.listdir(SOURCE_DIR) if f.lower().endswith(".pdf")]

for filename in files:
    pdf_path = os.path.join(SOURCE_DIR, filename)
    md_filename = filename.replace(".pdf", ".md").replace(".PDF", ".md")
    md_path = os.path.join(DEST_DIR, md_filename)

    try:
        # One-line magic: extracts text, tables, headers, and fixes layout
        md_text = pymupdf4llm.to_markdown(pdf_path)

        # Save as Markdown file (better than .txt for RAG ingestion)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_text)

        print(f"Converted: {filename} -> {md_filename}")

    except Exception as e:
        print(f"Failed to convert {filename}: {e}")

print("\n--- All Done! Point your RAG app to the .md files now. ---")