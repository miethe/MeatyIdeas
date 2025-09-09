from __future__ import annotations

import logging as std_logging
import sys
from typing import Any

import structlog


def setup_logging() -> None:
    timestamper = structlog.processors.TimeStamper(fmt="iso")

    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            timestamper,
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    handler = std_logging.StreamHandler(sys.stdout)
    handler.setFormatter(std_logging.Formatter("%(message)s"))
    root = std_logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(std_logging.INFO)


def get_logger(**kwargs: Any) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger().bind(**kwargs)

