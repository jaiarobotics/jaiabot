#!/usr/bin/env bash
set -e

echo "=== Setting up Ollama (Custom Path: /var/log/ollama) ==="

# --- Step 1: Update and install base packages ---
echo "[1/6] Updating package list..."
sudo apt update -y

echo "[2/6] Installing system dependencies..."

sudo apt install -y \
  curl \
  python3 \
  python3-venv \
  python3-dev \
  python3-pip \
  python3-numpy \
  python3-watchdog \
  libopenblas-dev \
  libffi-dev

# --- Step 1.5: Ensure uv is installed & loaded ---
if ! command -v uv &> /dev/null; then
    echo "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

if [ -f "$HOME/.local/bin/env" ]; then
    . "$HOME/.local/bin/env"
elif [ -f "$HOME/.cargo/env" ]; then
    . "$HOME/.cargo/env"
fi
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

setup_python_env() {
    echo "[3/6] (Background) Setting up Python environment..."
    if [ ! -d ".venv" ]; then
        uv venv
    fi
    if [ -f "requirements.txt" ]; then
        uv pip install -r requirements.txt
    fi
}

install_ollama_binary() {
    echo "[4/6] (Background) Installing Ollama Binary..."
    if ! command -v ollama &> /dev/null; then
        curl -fsSL https://ollama.com/install.sh | sh
    else
        echo "Ollama binary already installed."
    fi
}

# --- Step 2 & 3: Run Python Setup and Ollama Install in Parallel ---
setup_python_env &
PID_PYTHON=$!

install_ollama_binary

wait $PID_PYTHON

ACTIVATE_SCRIPT=".venv/bin/activate"
if [ -f "$ACTIVATE_SCRIPT" ]; then
  # shellcheck source=/dev/null
  . "$ACTIVATE_SCRIPT"
fi

# --- Step 4: Configure Custom Directory & Optimization ---
echo "[5/6] Configuring Custom Model Directory..."

TARGET_DIR="/var/log/ollama"
sudo mkdir -p "$TARGET_DIR"
sudo chown -R ollama:ollama "$TARGET_DIR"
sudo chmod -R 775 "$TARGET_DIR"

# FORCE 4-bit Quantization for Context (Critical since we aren't using ZRAM)
sudo mkdir -p /etc/systemd/system/ollama.service.d
echo "[Service]
Environment=\"OLLAMA_MODELS=$TARGET_DIR/models\"
Environment=\"OLLAMA_NUM_PARALLEL=1\"
" | sudo tee /etc/systemd/system/ollama.service.d/override.conf > /dev/null

sudo systemctl daemon-reload
sudo systemctl restart ollama

echo "Waiting for Ollama to reload..."
until curl -s http://localhost:11434 > /dev/null; do
    sleep 1
done

# --- Step 5: Pull Specific Quantized Models ---
echo "[6/6] Pulling Models..."

pull_model() {
    echo "Starting pull for $1..."
    ollama pull "$1" && echo "Finished pulling $1" || echo "Failed to pull $1"
}

# 1. Specific Quantized Chat Model
pull_model "ministral-3:3b" &
PID_MODEL1=$!

# 2. Embedding Model
pull_model "nomic-embed-text" &
PID_MODEL2=$!

wait $PID_MODEL1
wait $PID_MODEL2

# --- Step 6: Verify ---
echo "===== Installation Complete ====="
echo "Models Stored In: $(du -sh $TARGET_DIR/models 2>/dev/null)"
echo "Ollama Version: $(ollama --version)"
