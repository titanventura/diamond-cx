# Diamond CX Backend

FastAPI backend powered by `uv` and Google Agent Development Kit (`google-adk`).

## Tech Stack

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **Package & Environment Manager**: [uv](https://docs.astral.sh/uv/)
- **Agent Orchestration**: [Google ADK](https://github.com/google/adk-python) & [Google GenAI SDK](https://github.com/googleapis/python-genai)
- **Live Streaming**: Gemini Live Multimodal Bidirectional WebSocket (Audio PCM 16kHz, Video Canvas JPEG, Text, Tools)
- **Settings & Validation**: [Pydantic v2](https://docs.pydantic.dev/) + `pydantic-settings`

---

## Project Structure

```
backend/
├── .python-version          # Pinned Python version (3.12)
├── pyproject.toml           # uv dependencies & project configuration
├── .env.example             # Environment variable template
├── README.md                # Documentation & instructions
└── app/
    ├── __init__.py
    ├── main.py              # FastAPI app, CORS, lifespan, root /ws alias
    ├── config.py            # Pydantic Settings (Live models, voice configs)
    ├── routes.py            # REST API router (/health, /agent/info, /agent/chat)
    ├── live_routes.py       # Live WebSocket endpoint (/api/v1/live/ws, /api/v1/live/info)
    ├── agent.py             # REST ADK agent definition & unary runner
    ├── live_agent.py        # Gemini Live facade, Runner & SessionManager
    ├── tools.py             # Mock tools: lookup_order_or_serial, query_product_knowledge
    └── models.py            # Pydantic request & response schemas
```

---

## Getting Started

### 1. Prerequisites

Make sure [`uv`](https://docs.astral.sh/uv/) is installed on your system:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 2. Environment Setup

Copy the `.env.example` template:
```bash
cp .env.example .env
```
Edit `.env` and set your `GEMINI_API_KEY`:
```env
GEMINI_API_KEY="your-gemini-api-key-here"
GEMINI_LIVE_MODEL="gemini-3.1-flash-live-preview"
LIVE_VOICE_NAME="Puck"
```

### 3. Install Dependencies

Sync the virtual environment and install packages:
```bash
uv sync
```

### 4. Run Development Server

Start the backend server with auto-reload:
```bash
uv run uvicorn app.main:app --reload --port 8000
```
- **Interactive API Docs (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Live Diagnostics**: [http://localhost:8000/api/v1/live/info](http://localhost:8000/api/v1/live/info)
- **Live WebSocket Endpoints**:
  - `ws://localhost:8000/ws/{user_id}/{session_id}`
  - `ws://localhost:8000/api/v1/live/ws/{user_id}/{session_id}`
