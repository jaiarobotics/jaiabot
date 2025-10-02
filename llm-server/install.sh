#!/usr/bin/env bash
set -e

# System deps
sudo apt update
sudo apt install -y python3 python3-venv python3-pip curl tesseract-ocr -y


# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Setup venv
python3 -m venv .venv
source .venv/bin/activate
rm -rf chroma_db
pip install -r requirements.txt

echo "✅ Installation complete. Run ./run.sh to start the server."
