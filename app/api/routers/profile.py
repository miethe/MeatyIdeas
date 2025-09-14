from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import User
from ..schemas import UserRead, UserUpdate


router = APIRouter(prefix="/me", tags=["profile"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_local_user(db: Session) -> User:
    u = db.get(User, "local")
    if not u:
        u = User(id="local", name="Local User", email="", avatar_url=None, preferences={})
        db.add(u)
        db.commit()
        db.refresh(u)
    return u


@router.get("", response_model=UserRead)
def get_me(db: Session = Depends(get_db)):
    return ensure_local_user(db)


@router.patch("", response_model=UserRead)
def update_me(body: UserUpdate, db: Session = Depends(get_db)):
    u = ensure_local_user(db)
    if body.name is not None:
        u.name = body.name
    if body.email is not None:
        u.email = body.email
    if body.avatar_url is not None:
        u.avatar_url = body.avatar_url
    if body.preferences is not None:
        u.preferences = body.preferences
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.post("/logout", status_code=204)
def logout():
    # Stateless: frontend clears token; nothing to do server-side
    return

