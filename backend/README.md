# Diamond CX Backend

FastAPI backend powered by `uv` and Google Agent Development Kit (`google-adk`).

## Tech Stack

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **Package & Environment Manager**: [uv](https://docs.astral.sh/uv/)
- **Agent Orchestration**: [Google ADK](https://github.com/google/adk-python) & [Google GenAI SDK](https://github.com/googleapis/python-genai)
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
    ├── main.py              # FastAPI app instance, CORS, lifespan, router mounting
    ├── config.py            # Pydantic Settings & environment variables
    ├── routes.py            # API routes (/health, /agent/info, /agent/chat)
    ├── agent.py             # Google ADK agent definition (root_agent) & runner
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
```

### 3. Install Dependencies

Sync the virtual environment and install packages:
```bash
uv sync
```

### 4. Run Development Server

#### Option A: FastAPI Application Server
Start the backend server with auto-reload:
```bash
uv run uvicorn app.main:app --reload --port 8000
```
- **Interactive API Docs (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative Docs (ReDoc)**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

#### Option B: Google ADK Developer Web UI
Launch the interactive Google ADK agent testing UI:
```bash
uv run adk web . --port 8080
```
- **ADK Web UI**: [http://localhost:8080](http://localhost:8080)
