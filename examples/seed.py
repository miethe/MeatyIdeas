#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys

import requests


API = os.getenv("IDEAS_API_BASE", "http://localhost:8080/api")
TOKEN = os.getenv("IDEAS_TOKEN", os.getenv("TOKEN", "devtoken"))

S = requests.Session()
S.headers.update({"X-Token": TOKEN, "Content-Type": "application/json"})


def main() -> None:
    r = S.post(f"{API}/projects", data=json.dumps({"name": "demo-idea-stream"}))
    if r.status_code not in (200, 201, 409):
        print("Failed to create project", r.text, file=sys.stderr)
        sys.exit(1)
    # Get projects
    r = S.get(f"{API}/projects")
    r.raise_for_status()
    data = r.json()
    projects = data.get("projects") if isinstance(data, dict) else data
    projects = projects or []
    proj = next((p for p in projects if p.get("slug") == "demo-idea-stream"), None)
    if not proj:
        print("Project missing", file=sys.stderr)
        sys.exit(1)
    pid = proj["id"]
    # Add files
    files = [
        {"path": "ideation/plan.md", "content_md": "# Plan\n\nHello"},
        {"path": "prd.md", "content_md": "# PRD\n\nDemo"},
    ]
    for f in files:
        S.post(f"{API}/files/project/{pid}", data=json.dumps(f))
    print("Seeded demo project")


if __name__ == "__main__":
    main()
