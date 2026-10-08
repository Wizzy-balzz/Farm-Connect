from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import logger
from app.database.connection import db

from app.api.health import router as health_router
from app.api.chat import router as chat_router
from app.api.actions import router as actions_router
from app.api.vision import router as vision_router
from app.api.voice import router as voice_router
from app.api.memory import router as memory_router
from app.api.goals import router as goals_router
from app.api.planner import router as planner_router
from app.api.proactive import router as proactive_router
from app.api.marketplace import router as marketplace_router
from app.api.analytics import router as analytics_router
from app.api.nlp_endpoint import router as nlp_router
from app.api.reason_endpoint import router as reason_router
from app.api.tools_endpoint import router as tools_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Service startup and graceful shutdown lifecycle."""
    logger.info("==================================================")
    logger.info("🌱 Starting FarmConnect Python AI/NLP Service")
    logger.info(f"Host: {settings.PYTHON_AI_HOST} | Port: {settings.PYTHON_AI_PORT}")
    logger.info("NLP Engine: Local Python NLP (Zero External LLM Dependency)")
    logger.info(f"Node.js Backend URL: {settings.NODE_BACKEND_URL}")

    # Validate database connectivity
    db_health = db.check_health()
    logger.info(f"Database Status: {db_health.get('engine', 'none').upper()} - Connected: {db_health.get('connected')}")
    logger.info("==================================================")

    yield

    logger.info("🛑 Shutting down FarmConnect Python AI/NLP Service gracefully.")


app = FastAPI(
    title="FarmConnect Python AI/NLP Service",
    description="Authoritative AI/NLP microservice for FarmConnect agricultural marketplace.",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration allowing requests from local Node gateway & dev tools
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5000",
        "http://localhost:5000",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(health_router)
app.include_router(chat_router)
app.include_router(actions_router)
app.include_router(vision_router)
app.include_router(voice_router)
app.include_router(memory_router)
app.include_router(goals_router)
app.include_router(planner_router)
app.include_router(proactive_router)
app.include_router(marketplace_router)
app.include_router(analytics_router)
app.include_router(nlp_router)
app.include_router(reason_router)
app.include_router(tools_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.PYTHON_AI_HOST,
        port=settings.PYTHON_AI_PORT,
        reload=settings.DEBUG
    )
