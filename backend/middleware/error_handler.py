from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from config import settings


def add_error_handlers(app: FastAPI):

    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        return JSONResponse(status_code=404, content={"error": "Route not found"})

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception):
        import logging
        logging.error(f"Unhandled error: {exc}")
        is_prod = settings.NODE_ENV == "production"
        message = "Internal server error" if is_prod else str(exc)
        return JSONResponse(status_code=500, content={"error": message})
