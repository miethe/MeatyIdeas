from __future__ import annotations

import json

import redis
from sqlalchemy.orm import Session

from .db import SessionLocal
from .models import Event
from .settings import settings


CHANNEL_PREFIX = "events:"


def _redis_client() -> redis.Redis:
    return redis.from_url(settings.redis_url)


def publish_event(project_id: str, event_type: str, payload: dict) -> None:
    # Persist to DB (best-effort)
    try:
        db: Session = SessionLocal()
        ev = Event(project_id=project_id, type=event_type, payload=payload)
        db.add(ev)
        db.commit()
    except Exception:
        pass
    finally:
        try:
            db.close()
        except Exception:
            pass

    # Publish over Redis
    msg = json.dumps({"type": event_type, "project_id": project_id, "payload": payload})
    try:
        r = _redis_client()
        r.publish(CHANNEL_PREFIX + project_id, msg)
    except Exception:
        pass

