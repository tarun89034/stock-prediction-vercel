# ─── Multi-stage Dockerfile for HuggingFace Spaces ───
# Stage 1: Build the Next.js static frontend
# Stage 2: Python backend + serve the built frontend

# ── Stage 1: Frontend Build ──
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/stock-prediction-platform-frontend/package.json frontend/stock-prediction-platform-frontend/package-lock.json* ./
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps
COPY frontend/stock-prediction-platform-frontend/ ./
RUN npm run build

# ── Stage 2: Backend + Serve ──
FROM python:3.11-slim

WORKDIR /app

# Install system deps for numpy/scipy/etc
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ gfortran libopenblas-dev liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./
COPY .env ./.env

# Copy built frontend into backend/static/
COPY --from=frontend-builder /app/frontend/out ./static/

# HuggingFace Spaces expects port 7860
ENV PORT=7860
EXPOSE 7860

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
