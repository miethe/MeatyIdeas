from __future__ import annotations

import os

from api.settings import settings as api_settings  # type: ignore
from api.bundle import export_bundle
import redis
import json
import datetime as dt
from git import Repo
from api.db import SessionLocal  # type: ignore
from api.models import Bundle as BundleModel  # type: ignore
import yaml
import shutil
import requests
import zipfile


def export(slug: str, project_id: str, project_name: str, file_rel_paths: list[str], include_checksums: bool = True, push_branch: bool = False, open_pr: bool = False, roles: dict[str, str] | None = None, bundle_id: str | None = None) -> dict:
    # Publish start event
    try:
        r = redis.from_url(api_settings.redis_url)
        r.publish(f"events:{project_id}", json.dumps({"type": "bundle.started", "project_id": project_id, "payload": {"count": len(file_rel_paths)}}))
    except Exception:
        pass
    proj_dir = os.path.join(api_settings.data_dir, "projects", slug)
    zip_path = export_bundle(project_name=project_name, project_slug=slug, project_dir=proj_dir, file_rel_paths=file_rel_paths, include_checksums=include_checksums, roles=roles or {})
    branch_name = None
    pr_url = None

    # Mark running in DB
    try:
        if bundle_id:
            db = SessionLocal()
            b = db.get(BundleModel, bundle_id)
            if b:
                b.status = "running"
                db.add(b)
                db.commit()
    except Exception:
        pass

    # Push branch and open PR if required
    if push_branch:
        try:
            art_dir = os.path.join(proj_dir, "artifacts")
            if not os.path.isdir(os.path.join(art_dir, ".git")):
                raise RuntimeError("Artifacts repo not connected")
            repo = Repo(art_dir)
            ts = dt.datetime.now(tz=dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            branch_name = f"bundle/{slug}/{ts}"
            try:
                base_branch = repo.active_branch.name
            except Exception:
                base_branch = "main"
            repo.git.checkout(base_branch)
            repo.git.checkout("-b", branch_name)
            # Extract bundle.yaml from zip
            try:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    bundle_yaml = zf.read("bundle.yaml")
            except Exception:
                manifest = {
                    "project": {"name": project_name, "slug": slug},
                    "generated_at": dt.datetime.now(tz=dt.timezone.utc).isoformat(),
                    "files": [],
                    "artifacts_dir": "artifacts/",
                }
                bundle_yaml = yaml.safe_dump(manifest, sort_keys=False).encode()
            with open(os.path.join(art_dir, "bundle.yaml"), "wb") as f:
                f.write(bundle_yaml)
            # Copy files/** from project
            for rel in file_rel_paths:
                src = os.path.join(proj_dir, rel)
                dst = os.path.join(art_dir, rel)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                if os.path.isdir(src):
                    continue
                shutil.copy2(src, dst)
            repo.git.add(["bundle.yaml", "files"])
            msg = f"chore(bundle): {slug} {ts}\n\nFiles:\n" + "\n".join(f"- {p}" for p in file_rel_paths)
            repo.index.commit(msg)
            if repo.remotes:
                repo.remotes.origin.push(branch_name)
            if open_pr and repo.remotes:
                remote_url = repo.remotes.origin.url
                pr = _try_open_github_pr(remote_url, base_branch, branch_name, project_name, file_rel_paths)
                if pr and pr.get("html_url"):
                    pr_url = pr["html_url"]
                    try:
                        r = redis.from_url(api_settings.redis_url)
                        r.publish(f"events:{project_id}", json.dumps({"type": "bundle.pr_opened", "project_id": project_id, "payload": {"url": pr_url}}))
                    except Exception:
                        pass
            # Event for branch pushed
            try:
                r = redis.from_url(api_settings.redis_url)
                r.publish(f"events:{project_id}", json.dumps({"type": "bundle.branch_pushed", "project_id": project_id, "payload": {"branch": branch_name}}))
            except Exception:
                pass
        except Exception as e:
            # Mark failure in DB
            try:
                if bundle_id:
                    db = SessionLocal()
                    b = db.get(BundleModel, bundle_id)
                    if b:
                        b.status = "failed"
                        b.error = str(e)
                        db.add(b)
                        db.commit()
            except Exception:
                pass
            # Emit failed event and return
            try:
                r = redis.from_url(api_settings.redis_url)
                r.publish(f"events:{project_id}", json.dumps({"type": "bundle.failed", "project_id": project_id, "payload": {"error": str(e)}}))
            except Exception:
                pass
            return {"zip_path": zip_path, "bundle_id": bundle_id, "branch": branch_name, "pr_url": pr_url, "error": str(e)}

    # Publish completion event
    try:
        r = redis.from_url(api_settings.redis_url)
        payload = {"job": "bundle", "zip_path": zip_path, "branch": branch_name, "pr_url": pr_url, "bundle_id": bundle_id}
        r.publish(f"events:{project_id}", json.dumps({"type": "bundle.completed", "project_id": project_id, "payload": payload}))
    except Exception:
        pass
    # Update DB bundle row
    try:
        if bundle_id:
            db = SessionLocal()
            b = db.get(BundleModel, bundle_id)
            if b:
                b.status = "completed"
                b.output_path = zip_path
                b.branch = branch_name
                b.pr_url = pr_url
                db.add(b)
                db.commit()
    except Exception:
        pass
    return {"zip_path": zip_path, "bundle_id": bundle_id, "branch": branch_name, "pr_url": pr_url}


def _try_open_github_pr(remote_url: str, base_branch: str, head_branch: str, project_name: str, file_rel_paths: list[str]) -> dict | None:
    token = os.getenv("GITHUB_TOKEN", None) or getattr(api_settings, "github_token", None)
    if not token:
        return None
    owner_repo = None
    if remote_url.startswith("git@github.com:"):
        owner_repo = remote_url.split(":", 1)[1].replace(".git", "")
    elif remote_url.startswith("https://github.com/"):
        owner_repo = remote_url.split("github.com/", 1)[1].replace(".git", "")
    if not owner_repo or "/" not in owner_repo:
        return None
    api = f"https://api.github.com/repos/{owner_repo}/pulls"
    title = f"Bundle: {project_name} ({head_branch})"
    body = "Generated bundle with files:\n\n" + "\n".join(f"- {p}" for p in file_rel_paths)
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
    resp = requests.post(api, json={"title": title, "head": head_branch, "base": base_branch, "body": body}, headers=headers, timeout=30)
    if resp.status_code >= 200 and resp.status_code < 300:
        return resp.json()
    return None
