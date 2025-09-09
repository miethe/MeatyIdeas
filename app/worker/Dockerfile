FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1


WORKDIR /app

# Copy requirements.txt from build context (which is ./app/worker)
COPY requirements.txt /app/worker/requirements.txt

RUN pip install --upgrade pip && pip install -r /app/worker/requirements.txt

COPY . /app

CMD ["python", "-m", "worker.worker"]

