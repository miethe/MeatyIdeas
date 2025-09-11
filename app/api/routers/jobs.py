from __future__ import annotations

from typing import Any

import redis
import rq
from fastapi import APIRouter, HTTPException

from ..settings import settings


router = APIRouter(prefix="/jobs", tags=["jobs"])


def _rq() -> rq.Queue:
    conn = redis.from_url(settings.redis_url)
    return rq.Queue("default", connection=conn)


@router.get("/{job_id}")
def get_job(job_id: str) -> dict[str, Any]:
    q = _rq()
    job = rq.job.Job.fetch(job_id, connection=q.connection)
    if not job:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Job"})
    data: dict[str, Any] = {
        "id": job.id,
        "status": job.get_status(refresh=True),
        "enqueued_at": job.enqueued_at.isoformat() if job.enqueued_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "ended_at": job.ended_at.isoformat() if job.ended_at else None,
    }
    if job.is_finished and job.result is not None:
        data["result"] = job.result
    if job.is_failed and job.exc_info:
        data["error"] = "FAILED"
    return data

