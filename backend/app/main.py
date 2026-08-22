import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.live_agent import live_agent_runner
from app.live_routes import live_websocket_endpoint
from app.routes import router as api_router

# Configure basic structured logging
settings = get_settings()
logging.basicConfig(
    level=settings.LOG_LEVEL.upper(),
    format="%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d - %(message)s",
)
logger = logging.getLogger("diamond_cx.backend")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application startup and shutdown lifespan events."""
    logger.info(
        "Starting %s v%s in %s mode (Live Model: %s)",
        settings.PROJECT_NAME,
        settings.VERSION,
        settings.ENVIRONMENT,
        settings.GEMINI_LIVE_MODEL,
    )
    yield
    logger.info("Shutting down %s and cleaning active Live sessions...", settings.PROJECT_NAME)


def create_app() -> FastAPI:
    """FastAPI application factory."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="Production-ready backend API service with Google Agent Development Kit (ADK) and Gemini Live Multimodal Streaming",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        lifespan=lifespan,
    )

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Global Exception Handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error processing request: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please check server logs.",
            },
        )

    # Mount API Router under prefix
    app.include_router(api_router, prefix=settings.API_V1_STR)

    # Convenience root websocket alias (e.g. ws://localhost:8000/ws/{user_id}/{session_id})
    app.add_api_websocket_route("/ws/{user_id}/{session_id}", live_websocket_endpoint)

    # Convenience root endpoint
    @app.get("/", tags=["System"])
    async def root() -> dict[str, str]:
        return {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "docs": "/docs",
            "health": f"{settings.API_V1_STR}/health",
            "live_info": f"{settings.API_V1_STR}/live/info",
            "live_websocket": "/ws/{user_id}/{session_id}",
        }

    return app


app = create_app()
