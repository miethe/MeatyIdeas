from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel
from markdown_it import MarkdownIt


router = APIRouter(prefix="/render", tags=["render"])

md = MarkdownIt("commonmark").enable("table").enable("strikethrough")


class RenderRequest(BaseModel):
    md: str


@router.post("/markdown")
def render_markdown(body: RenderRequest):
    html = md.render(body.md)
    return {"html": html}

