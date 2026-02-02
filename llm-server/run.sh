#!/usr/bin/env bash
set -e

APP_DIR="$(dirname "$(realpath "$0")")"
VENV_PATH="$APP_DIR/.venv"

echo "Checking environment..."

if [ ! -d "$VENV_PATH" ]; then
  echo "Virtual environment not found at $VENV_PATH"
  echo "Please run the install script first."
  exit 1
fi

# --- Check Native Ollama Service ---
echo "Verifying Ollama service status..."

# 1. Check if systemd service is active
if ! systemctl is-active --quiet ollama; then
    echo "Ollama service is not running. Attempting to start..."
    # Try to start it (will prompt for password if sudo is required/configured)
    sudo systemctl start ollama || {
        echo "Failed to start Ollama service."
        exit 1
    }
fi

# 2. Check if the API is actually listening
# Sometimes systemd says "active" but the server is still booting up
if ! curl -s http://localhost:11434 > /dev/null; then
    echo "Ollama is starting up, waiting for API..."
    sleep 2
    if ! curl -s http://localhost:11434 > /dev/null; then
         echo "Ollama service is running but API is unreachable on port 11434."
         exit 1
    fi
fi
echo "Ollama is ready."

echo "Activating virtual environment..."
# shellcheck source=/dev/null
source "$VENV_PATH/bin/activate"

echo "Starting FastAPI server..."
echo "Visit: http://localhost:8000"


uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload \
  --log-level info
