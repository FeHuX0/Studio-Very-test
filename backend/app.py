import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .models import AssetBatch, Project

def create_app(data_dir: Path | None = None) -> FastAPI:
    directory = data_dir or Path(os.getenv("FORMA_DATA_DIR", ".data"))
    directory.mkdir(parents=True, exist_ok=True)
    database = directory / "forma.sqlite3"

    @contextmanager
    def connection():
        with sqlite3.connect(database, timeout=10) as db:
            db.row_factory = sqlite3.Row
            yield db

    with connection() as db:
        db.execute("CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, body TEXT NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, updated TEXT NOT NULL)")

    app = FastAPI(title="Форма SVG Studio API", version="1.0.0")

    @app.middleware("http")
    async def local_api_boundary(request: Request, call_next):
        if request.url.path.startswith("/api"):
            # Local app: forbid cross-origin writes, including browser form posts.
            origin = request.headers.get("origin")
            if origin and origin not in {f"http://127.0.0.1:{port}" for port in (5173, 4173, 8000)} | {f"http://localhost:{port}" for port in (5173, 4173, 8000)}:
                return JSONResponse({"detail": "Недопустимый источник запроса"}, status_code=403)
            if request.method in {"POST", "PUT", "PATCH"}:
                if "application/json" not in request.headers.get("content-type", ""):
                    return JSONResponse({"detail": "Ожидается application/json"}, status_code=415)
                length = request.headers.get("content-length")
                if length and (not length.isdecimal() or int(length) > 20 * 1024 * 1024):
                    return JSONResponse({"detail": "Размер запроса превышает 20 МБ"}, status_code=413)
                received = 0
                parts = []
                async for chunk in request.stream():
                    received += len(chunk)
                    if received > 20 * 1024 * 1024:
                        return JSONResponse({"detail": "Размер запроса превышает 20 МБ"}, status_code=413)
                    parts.append(chunk)
                request._body = b"".join(parts)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        return response

    @app.get("/api/health")
    def health():
        return {"status": "ok", "semanticMode": "local", "aiEnabled": False}

    @app.get("/api/assets")
    def list_assets():
        with connection() as db:
            return [json.loads(row["body"]) for row in db.execute("SELECT body FROM assets ORDER BY id")]

    @app.post("/api/assets")
    def save_assets(batch: AssetBatch):
        with connection() as db:
            for asset in batch.assets:
                body = asset.model_dump(exclude_none=True)
                previous = db.execute("SELECT body FROM assets WHERE id = ?", (asset.id,)).fetchone()
                if previous:
                    old = json.loads(previous["body"])
                    body["sources"] = {**old["sources"], **body["sources"]}
                    body["sizeVariants"] = sorted(set(old["sizeVariants"] + body["sizeVariants"]))
                db.execute("INSERT INTO assets (id, body) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET body=excluded.body", (asset.id, json.dumps(body, ensure_ascii=False)))
        return {"saved": len(batch.assets)}

    @app.get("/api/projects")
    def list_projects():
        with connection() as db:
            return [dict(row) for row in db.execute("SELECT id, title, updated FROM projects ORDER BY updated DESC LIMIT 100")]

    @app.post("/api/projects")
    def save_project(project: Project):
        # Stable per composition; saving edits updates rather than multiplying copies.
        key = project.composition.id or str(uuid4())
        updated = datetime.now(timezone.utc).isoformat()
        with connection() as db:
            db.execute("INSERT INTO projects (id, title, body, updated) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, body=excluded.body, updated=excluded.updated", (key, project.title, project.model_dump_json(exclude_none=True), updated))
        return {"id": key, "updated": updated}

    @app.get("/api/projects/{project_id}")
    def get_project(project_id: str):
        with connection() as db:
            row = db.execute("SELECT body FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Проект не найден")
        return json.loads(row["body"])

    dist = Path(__file__).resolve().parent.parent / "dist"
    if dist.is_dir():
        app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
    return app

app = create_app()
