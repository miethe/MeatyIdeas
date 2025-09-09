from __future__ import annotations

import os
import re
from typing import Tuple


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip().lower()).strip("-")
    return slug or "project"


def safe_join(base: str, *paths: str) -> str:
    p = os.path.abspath(os.path.join(base, *paths))
    base_abs = os.path.abspath(base)
    if not p.startswith(base_abs + os.sep) and p != base_abs:
        raise ValueError("Path traversal detected")
    return p

