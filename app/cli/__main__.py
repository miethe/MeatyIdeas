from __future__ import annotations

import json
import sys
from typing import Optional

import requests
import typer

from .config import load_config


app = typer.Typer(help="Ideas CLI")


def client():
    cfg = load_config()
    s = requests.Session()
    s.headers.update({"X-Token": cfg.token, "Content-Type": "application/json"})
    return cfg, s


def find_project_by_slug(s: requests.Session, api_base: str, slug: str) -> Optional[dict]:
    r = s.get(f"{api_base}/projects")
    r.raise_for_status()
    for p in r.json():
        if p["slug"] == slug:
            return p
    return None


@app.command()
def new(name: str, description: str = typer.Option("", help="Description")):
    cfg, s = client()
    r = s.post(f"{cfg.api_base}/projects", data=json.dumps({"name": name, "description": description}))
    r.raise_for_status()
    typer.echo(r.json()["slug"]) 


@app.command()
def add(project: str = typer.Option(..., help="Project slug"), path: str = typer.Option(..., help="File path")):
    cfg, s = client()
    p = find_project_by_slug(s, cfg.api_base, project)
    if not p:
        typer.echo("Project not found", err=True)
        raise typer.Exit(code=1)
    content = sys.stdin.read()
    body = {"path": path, "content_md": content, "title": None}
    r = s.post(f"{cfg.api_base}/files/project/{p['id']}", data=json.dumps(body))
    r.raise_for_status()
    typer.echo(r.json()["id"]) 


@app.command()
def search(q: str):
    cfg, s = client()
    r = s.get(f"{cfg.api_base}/search", params={"q": q})
    r.raise_for_status()
    for item in r.json():
        typer.echo(item["file_id"]) 


@app.command()
def artifacts_connect(project: str, repo_url: str = typer.Option(None)):
    cfg, s = client()
    p = find_project_by_slug(s, cfg.api_base, project)
    if not p:
        typer.echo("Project not found", err=True)
        raise typer.Exit(code=1)
    r = s.post(f"{cfg.api_base}/projects/{p['id']}/artifacts/connect", data=json.dumps({"repo_url": repo_url, "provider": "local"}))
    r.raise_for_status()
    typer.echo("connected")


@app.command()
def bundle_create(project: str, all: bool = typer.Option(True, help="Include all project files")):
    cfg, s = client()
    p = find_project_by_slug(s, cfg.api_base, project)
    if not p:
        typer.echo("Project not found", err=True)
        raise typer.Exit(code=1)
    # list files
    r = s.get(f"{cfg.api_base}/projects/{p['id']}/files")
    r.raise_for_status()
    file_ids = [f["id"] for f in r.json()]
    r = s.post(f"{cfg.api_base}/projects/{p['id']}/export/bundle", data=json.dumps({"file_ids": file_ids}))
    r.raise_for_status()
    typer.echo(r.json()["zip_path"]) 


if __name__ == "__main__":
    app()

