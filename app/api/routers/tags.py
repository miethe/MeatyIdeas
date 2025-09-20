from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..services.tagging import get_tag_usage


router = APIRouter(prefix="/tags", tags=["tags"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("")
def list_tags(q: str | None = None, limit: int = 200, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return get_tag_usage(db, limit=limit, q=q)
