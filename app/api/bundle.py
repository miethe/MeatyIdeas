from __future__ import annotations

import datetime as dt
import hashlib
import os
import zipfile
from typing import Iterable

import yaml


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def export_bundle(
    *,
    project_name: str,
    project_slug: str,
    project_dir: str,
    file_rel_paths: Iterable[str],
) -> str:
    bundles_dir = os.path.join(project_dir, "bundles")
    os.makedirs(bundles_dir, exist_ok=True)
    ts = dt.datetime.now(tz=dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    zip_path = os.path.join(bundles_dir, f"{project_slug}-{ts}.zip")

    files_info = []
    for rel in file_rel_paths:
        abs_path = os.path.join(project_dir, rel)
        files_info.append(
            {
                "path": rel,
                "sha256": sha256_file(abs_path) if os.path.exists(abs_path) else "",
                "role": "",
            }
        )

    manifest = {
        "project": {"name": project_name, "slug": project_slug},
        "generated_at": dt.datetime.now(tz=dt.timezone.utc).isoformat(),
        "files": files_info,
        "artifacts_dir": "artifacts/",
        "notes": "Exported for agent execution.",
    }

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        # Add files under files/
        for rel in file_rel_paths:
            abs_path = os.path.join(project_dir, rel)
            if os.path.exists(abs_path):
                z.write(abs_path, os.path.join(rel))
        # Add bundle.yaml at root
        z.writestr("bundle.yaml", yaml.safe_dump(manifest, sort_keys=False))

    return zip_path


def export_bundle_cli() -> None:
    print("Use API endpoint /api/projects/{id}/export/bundle to create bundles.")

