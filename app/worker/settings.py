from __future__ import annotations

import os


REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
DATA_DIR = os.getenv("DATA_DIR", "/data")

