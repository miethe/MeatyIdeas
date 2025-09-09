from __future__ import annotations

import os
from dataclasses import dataclass


CONFIG_DIR = os.path.expanduser("~/.ideas")
CONFIG_PATH = os.path.join(CONFIG_DIR, "config.toml")


@dataclass
class Config:
    api_base: str = os.getenv("IDEAS_API_BASE", "http://localhost:8080/api")
    token: str = os.getenv("IDEAS_TOKEN", os.getenv("TOKEN", "devtoken"))


def load_config() -> Config:
    os.makedirs(CONFIG_DIR, exist_ok=True)
    return Config()

