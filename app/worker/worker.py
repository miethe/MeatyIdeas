from __future__ import annotations

import os
import sys

import rq
import redis

from .settings import REDIS_URL


def main() -> None:
    conn = redis.from_url(REDIS_URL)
    with rq.Connection(conn):
        q = rq.Queue("default")
        w = rq.Worker([q])
        w.work(with_scheduler=True)


if __name__ == "__main__":
    main()

