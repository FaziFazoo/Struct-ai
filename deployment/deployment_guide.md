# AI FEA Copilot - Deployment Guide

This guide describes how to deploy the AI FEA Copilot system to Google Cloud.

## Prerequisites
- Google Cloud Project with Billing enabled.
- gcloud CLI installed.
- Vertex AI and Cloud Run APIs enabled.
- Application Default Credentials (ADC) or Service Account with Vertex AI User role.

## Backend Deployment (Google Cloud Run)

1. **Build and Push Container**:
   ```bash
   gcloud builds submit --tag gcr.io/[PROJECT_ID]/ai-fea-backend
   ```

    gcloud run deploy ai-fea-backend \
      --image gcr.io/[PROJECT_ID]/ai-fea-backend \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated \
      --set-env-vars GOOGLE_CLOUD_PROJECT=[PROJECT_ID],GOOGLE_CLOUD_LOCATION=us-central1

## Frontend Deployment (Firebase Hosting or Cloud Run)

1. **Build Frontend**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy**:
   You can deploy the build folder to Firebase Hosting or wrap it in an Nginx Docker container and deploy to Cloud Run.

## Local Development

1. **Backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm start
   ```
