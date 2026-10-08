# 1. Build the React app (Vite + shadcn) into static files.
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json frontend/.npmrc ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2. The Python court serves the API and the built page.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY lotcouncil ./lotcouncil
COPY data ./data
COPY scripts ./scripts
COPY --from=web /web/build ./frontend/build

RUN useradd --create-home court && chown -R court /app
USER court
EXPOSE 8000
CMD ["sh", "-c", "uvicorn lotcouncil.server:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
