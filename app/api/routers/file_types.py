from __future__ import annotations

from typing import Iterator

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..schemas import FileTypeCreateRequest, FileTypeOption
from ..services.file_types import as_option, ensure_file_type, list_file_type_options
from .config import invalidate_config_cache

router = APIRouter(prefix="/file-types", tags=["file-types"])


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("", response_model=list[FileTypeOption])
def list_file_types(db: Session = Depends(get_db)) -> list[FileTypeOption]:
    return list_file_type_options(db)


@router.post("", response_model=FileTypeOption, status_code=status.HTTP_201_CREATED)
def create_file_type(
    payload: FileTypeCreateRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> FileTypeOption:
    try:
        item, created = ensure_file_type(db, label=payload.label, color=payload.color, icon=payload.icon)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    invalidate_config_cache()
    if not created:
        response.status_code = status.HTTP_200_OK
    return as_option(item)
