# RAG Server with Ollama + FastAPI

A sophisticated Retrieval-Augmented Generation (RAG) server that combines FastAPI, Ollama, and FAISS to create an intelligent document processing and chat system. This application enables users to chat with jaia documents using AI-powered retrieval and generation.

## Architecture Overview

The system follows a modern RAG architecture with the following components:

1. **Document Processing Pipeline**: Converts PDF documents to Markdown format for optimal ingestion
2. **Vector Database**: Uses FAISS for efficient similarity search and retrieval
3. **AI Models**: Leverages Ollama for both embedding generation and chat responses
4. **Web Interface**: FastAPI backend with WebSocket support for real-time chat
5. **Memory Management**: Sophisticated model lifecycle management to optimize resource usage

## Key Features

- **Real-time Chat Interface**: WebSocket-based chat with streaming responses
- **Document Retrieval**: Intelligent search across processed documents
- **Source Attribution**: Shows document sources for retrieved information
- **Model Management**: Automatic model loading/unloading with heartbeat monitoring
- **Concurrent Session Support**: Handles multiple users with session management
- **PDF Processing**: Converts PDF documents to Markdown for better RAG performance

## System Design & Technical Decisions

### Model Architecture

The application uses a dual-model approach:
- **Chat Model**: `ministral-3:3b` (ollama quantizes by default for efficiency)
- **Embedding Model**: `nomic-embed-text` (optimized for semantic search)

**Justification**: This separation allows for specialized models optimized for their respective tasks. The quantized chat model reduces memory usage while maintaining performance, and the dedicated embedding model ensures high-quality semantic search.

### Vector Database Choice

**FAISS** was selected over alternatives like ChromaDB or Pinecone because:
- **Performance**: Optimized for similarity search at scale
- **Local Storage**: No external dependencies or API costs
- **Integration**: Native support in LangChain ecosystem
- **Control**: Full control over indexing and storage

### Memory Management Strategy

The application implements a sophisticated memory management system:
- **Model Unloading**: Automatically unloads models after 2 minutes of inactivity
- **Heartbeat System**: Maintains model in memory during active sessions
- **Resource Optimization**: Prevents VRAM exhaustion on resource-constrained systems

**Justification**: This approach balances performance with resource constraints, particularly important for systems without ZRAM or limited VRAM.

### Document Processing Pipeline

The pipeline converts PDFs to Markdown using `pymupdf4llm`, then processes them through:
1. **Header-based Splitting**: Preserves document structure using Markdown headers
2. **Recursive Chunking**: Creates fixed-size chunks (256 chars) with overlap (32 chars)
3. **Metadata Preservation**: Maintains source information for attribution

**Justification**: Markdown format provides better structure preservation than plain text, and the dual-splitting approach ensures both semantic coherence and efficient retrieval.

## Installation & Setup

### Prerequisites

- Ubuntu/Debian-based Linux system
- Python 3.13+
- Sufficient disk space for models (~6GB)

### Installation Steps

1. **Clone and Navigate**
```bash
cd llm-server
```

2. **Make Scripts Executable**
```bash
chmod +x install.sh run.sh
```

3. **Run Installation**
```bash
./install.sh
```

4. **Start the Server**
```bash
./run.sh
```

### Manual Installation (Alternative)

For systems where the automated script doesn't work:

1. **Install System Dependencies**
```bash
sudo apt update
sudo apt install -y curl python3 python3-venv python3-dev python3-pip python3-numpy python3-watchdog libopenblas-dev libffi-dev
```

2. **Install Python Dependencies**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. **Install Ollama**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

4. **Configure Ollama Service**
```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
echo "[Service]
Environment=\"OLLAMA_MODELS=/var/log/ollama/models\"
Environment=\"OLLAMA_NUM_PARALLEL=1\"
" | sudo tee /etc/systemd/system/ollama.service.d/override.conf > /dev/null
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

5. **Pull Required Models**
```bash
ollama pull ministral-3:3b
ollama pull nomic-embed-text
```

## Document Processing

### Converting PDF Documents

Before the RAG system can process documents, they must be converted from PDF to Markdown format:

```bash
python convert_docs.py
```

**Requirements**:
- Source PDFs should be placed in `../src/doc/`
- Converted Markdown files will be saved to `../src/doc_clean/`

### Building the Vector Index

After converting documents, build the FAISS index:

```bash
python build_faiss.py
```

This creates the `faiss_index` directory containing the vector database.

## Usage

### Starting the Server

```bash
./run.sh
```

The server will be available at `http://localhost:8000`

### Web Interface

The web interface provides:
- **Real-time Chat**: WebSocket-based communication
- **Document Sources**: Clickable source chips showing document origins
- **Session Management**: Handles concurrent users by allowing for session takeover to protect resources
- **Streaming Responses**: Real-time token-by-token generation

### API Endpoints

- `GET /` - Main chat interface
- `GET /get_source` - Retrieve document content by source path
- `WS /ws` - WebSocket endpoint for chat

## Development & Customization

### Configuration

Key configuration options are defined in `main.py`:
- `MODEL_NAME`: Chat model to use
- `OLLAMA_URL`: Ollama server URL
- `SYSTEM_TEMPLATE`: System prompt template

### Adding New Models

To add new models:
1. Pull the model using Ollama
2. Update the configuration in `main.py`
3. Rebuild the vector index if using a different embedding model

### Extending Functionality

The application is designed to be extensible:
- **Custom Retrievers**: Modify `rag/retriever.py` for different vector stores
- **New Models**: Add support for different AI models
- **Additional Features**: Extend the FastAPI routes and frontend

## Troubleshooting

### Common Issues

1. **Model Not Found**
   - Ensure Ollama service is running
   - Verify models are pulled correctly
   - Check `/var/log/ollama/models` directory

2. **Vector Index Missing**
   - Run `python build_faiss.py` after converting documents
   - Ensure `../src/doc_clean/` contains Markdown files

3. **Port Conflicts**
   - Change port in `run.sh` if 8000 is occupied
   - Ensure no other FastAPI instances are running

4. **Memory Issues**
   - The application automatically manages memory
   - Consider using smaller models on resource-constrained systems

### Performance Optimization

- **Model Quantization**: Use quantized models to reduce memory usage
- **Chunk Size**: Adjust chunk size in `build_faiss.py` for your use case
- **Index Optimization**: Rebuild index with different parameters if needed

## Security Considerations

- **Model Access**: Ollama runs locally, no external API exposure
- **File Access**: Document access is controlled through the API
- **WebSocket Security**: Basic authentication can be added if needed

