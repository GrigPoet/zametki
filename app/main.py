from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware

from app.routers import auth, notes, tags

# ВАЖНО: не "secret", не "123". Сгенерируй свой:
# python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY = "068fa0514270a0b9739dc9472eb8f3e38d207f7a52bc7faaf85450d3af81b590"

app = FastAPI(title="Notes with tags")

app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    session_cookie="notes_session",
)

app.include_router(auth.router)
app.include_router(tags.router)
app.include_router(notes.router)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")