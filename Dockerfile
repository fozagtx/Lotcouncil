FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY lotcouncil ./lotcouncil
COPY web ./web
COPY data ./data
COPY scripts ./scripts

RUN useradd --create-home court && chown -R court /app
USER court
EXPOSE 8000
CMD ["sh", "-c", "uvicorn lotcouncil.server:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
