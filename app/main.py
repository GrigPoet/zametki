import os

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.routers import auth, notes, tags

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "068fa0514270a0b9739dc9472eb8f3e38d207f7a52bc7faaf85450d3af81b590",
)

app = FastAPI(
    title="Notes with tags",
    description="Вариант 7 — заметки с тегами (FastAPI + SQLAlchemy 2.0 + SQLite)",
)

app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    session_cookie="notes_session",
    max_age=14 * 24 * 60 * 60,
    same_site="lax",
)

app.include_router(auth.router)
app.include_router(tags.router)
app.include_router(notes.router)

app.mount("/static", StaticFiles(directory="app/static", html=True), name="static")


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/static/login.html")