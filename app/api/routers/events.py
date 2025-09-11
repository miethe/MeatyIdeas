from __future__ import annotations

import json
from typing import Iterator

import redis
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..settings import settings


router = APIRouter(prefix="/events", tags=["events"])


def _redis_client() -> redis.Redis:
    return redis.from_url(settings.redis_url)


def _sse_format(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


@router.get("/stream")
def stream(project_id: str, token: str | None = None):
    # simple token check via query param (EventSource cannot set headers)
    from ..settings import settings as app_settings  # local import to avoid cycle
    if app_settings.token and token and token != app_settings.token:
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED"})
    r = _redis_client()
    channel = f"events:{project_id}"
    pubsub = r.pubsub()
    pubsub.subscribe(channel)

    def gen() -> Iterator[bytes]:
        # Send initial comment to establish stream
        yield b": ok\n\n"
        for msg in pubsub.listen():
            if msg.get("type") != "message":
                continue
            data = msg.get("data")
            if isinstance(data, bytes):
                try:
                    event = json.loads(data.decode("utf-8"))
                except Exception:
                    event = {"raw": data.decode("utf-8", errors="ignore")}
            else:
                event = {"raw": str(data)}
            yield _sse_format(event).encode("utf-8")

    return StreamingResponse(gen(), media_type="text/event-stream")
