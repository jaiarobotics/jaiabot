#!/usr/bin/env bash
set -e

source .venv/bin/activate

# Start Ollama in background if not running
if ! pgrep -x "ollama" > /dev/null; then
  echo "🔄 Starting Ollama..."
  ollama serve &
  sleep 5
fi

# Ensure model is pulled
#ollama pull gemma3:27b-it-qat
ollama pull gemma3:12b-it-qat
#ollama pull nomic-embed-text
ollama pull mxbai-embed-large


# Start FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
