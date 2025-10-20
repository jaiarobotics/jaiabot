#!/bin/bash
# ============================================================
# Setup + Auto-Activate Environment for Bottom Dive Analysis
# ============================================================

ENV_NAME="bottom_env"
PYTHON_VERSION="3"

echo "🔧 Creating virtual environment: $ENV_NAME (Python $PYTHON_VERSION)"
python$PYTHON_VERSION -m venv $ENV_NAME

# Check creation success
if [ ! -d "$ENV_NAME" ]; then
    echo " Failed to create virtual environment."
    exit 1
fi

echo "Environment created successfully."

# Activate environment
source bottom_env/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install \
    numpy \
    pandas \
    matplotlib \
    scikit-learn \
    h5py \
    seaborn \
    jupyterlab

echo " Environment setup complete!"
echo " Virtual environment '$ENV_NAME' is now active."
echo
echo "Run your scripts with:"
echo "  python your_script_name.py"
echo
echo "To deactivate later, run:"
echo "  deactivate"
