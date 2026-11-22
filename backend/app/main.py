import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import engine, Base, SessionLocal
from app.routers import tickets, customer, agents, audit
from app.seed_data import seed_database
from app.config import settings

# Create database tables
Base.metadata.create_all(bind=engine)

# Seed agents & initial tickets if not already present
with SessionLocal() as db:
    seed_database(db)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Arvo Systems Frontdesk - Intelligent Support Management System with Business Hours SLA & Tamper-Proof Audit Trails",
    version="1.0.0"
)

# Enable CORS for frontend and external access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(tickets.router)
app.include_router(customer.router)
app.include_router(agents.router)
app.include_router(audit.router)

@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "Arvo Frontdesk Backend",
        "database": settings.DATABASE_URL.split("://")[0]
    }

# Serve SPA static files if present
static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
if os.path.exists(static_dir):
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "docs" or full_path == "openapi.json":
            return None
        file_path = os.path.join(static_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))


