# Combined Frontend & Backend Build
# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Final Image
FROM python:3.10-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy built frontend from Stage 1 to backend's static folder
COPY --from=frontend-build /frontend/build ./static/frontend

# Create directory for static plots
RUN mkdir -p static/plots

EXPOSE 8080

# Use the PORT environment variable provided by Cloud Run
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
