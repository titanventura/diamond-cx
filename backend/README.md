# Diamond CX Backend

Production-ready FastAPI backend powered by `uv` and Google Agent Development Kit (`google-adk`).

## Tech Stack

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **Package & Environment Manager**: [uv](https://docs.astral.sh/uv/)
- **Agent Orchestration**: [Google ADK](https://github.com/google/adk-python) & [Google GenAI SDK](https://github.com/googleapis/python-genai)
- **Settings & Validation**: [Pydantic v2](https://docs.pydantic.dev/) + `pydantic-settings`
- **Testing & Quality**: `pytest`, `pytest-asyncio`, `httpx`, `ruff`

---

## Project Structure

```
backend/
├── .python-version          # Pinned Python version (3.12)
├── pyproject.toml           # uv dependencies & project configuration
├── .env.example             # Environment variable template
├── README.md                # Documentation & instructions
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app instance, CORS, lifespan, router mounting
│   ├── config.py            # Pydantic Settings & environment variables
│   ├── routes.py            # API routes (/health, /agent/info, /agent/chat)
│   ├── agent.py             # Google ADK agent definition & runner
│   └── models.py            # Pydantic request & response schemas
└── tests/
    ├── __init__.py
    ├── conftest.py          # Pytest fixtures and async test client
    └── test_main.py         # Automated API tests
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

Sync the virtual environment and install all packages:
```bash
uv sync
```

### 4. Run Development Server

Start the local server with auto-reload:
```bash
uv run uvicorn app.main:app --reload --port 8000
```

- **Interactive API Docs (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative Docs (ReDoc)**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

## Testing & Code Quality

Run automated tests:
```bash
uv run pytest
```

Run linter checks:
```bash
uv run ruff check .
```

Auto-format code:
```bash
uv run ruff format .
```
