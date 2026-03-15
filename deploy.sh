#!/bin/bash
# AI FEA Copilot - One-Click Deployment Script

PROJECT_ID="project-2dc5bd49-c8ce-4889-95a"
REGION="us-central1"

echo "🚀 Starting deployment to Google Cloud Project: $PROJECT_ID"

# 1. Deploy Backend
echo "📦 Building and deploying Backend..."
cd backend
gcloud builds submit --tag gcr.io/$PROJECT_ID/struct-ai-backend
gcloud run deploy struct-ai-backend \
  --image gcr.io/$PROJECT_ID/struct-ai-backend \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$REGION

# 2. Deploy Frontend
echo "🎨 Building and deploying Frontend..."
# Note: Using the Dockerfile.frontend from the deployment folder
gcloud builds submit --tag gcr.io/$PROJECT_ID/struct-ai-frontend --dockerfile deployment/Dockerfile.frontend .
gcloud run deploy struct-ai-frontend \
  --image gcr.io/$PROJECT_ID/struct-ai-frontend \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated

echo "✅ Deployment Complete!"
echo "Backend: https://struct-ai-backend-962155187689.us-central1.run.app"
echo "Frontend: https://struct-ai-frontend-962155187689.us-central1.run.app"
