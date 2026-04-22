"""Centralized domain-exception → HTTP-response mapping.

Routes used to wrap every service call in a try/except and re-raise as
`HTTPException(400, ...)`. That boilerplate is now gone — each domain
exception is registered here once and every route picks up the mapping
automatically.

Register from `main.py` by calling `register_exception_handlers(app)`
during startup.
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.services.card_classifier import CardValidationError
from app.services.file_parser import FileParseError, UnsupportedFileError


def register_exception_handlers(app: FastAPI) -> None:
    """Attach handlers for every domain exception the API surface raises.

    All of these map to HTTP 400 — they're client-input problems, not
    server-side failures. The generic Exception handler in `main.py`
    still catches anything else and returns 500 with an opaque id.
    """

    @app.exception_handler(CardValidationError)
    async def _card_validation(_: Request, exc: CardValidationError):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(UnsupportedFileError)
    async def _unsupported_file(_: Request, exc: UnsupportedFileError):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(FileParseError)
    async def _file_parse(_: Request, exc: FileParseError):
        return JSONResponse(
            status_code=400, content={"detail": f"failed to parse file: {exc}"}
        )
