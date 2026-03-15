#!/bin/bash
set -e

PROJECT_ID="project-2dc5bd49-c8ce-4889-95a"
REGION="us-central1"

# Hardcoded Backend URL from your successful deployment
BACKEND_URL="https://struct-ai-backend-962155187689.us-central1.run.app"

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

echo "✅ Backend updated: $BACKEND_URL"

# 2. Deploy Frontend
echo "🎨 Building and deploying Frontend..."
cd ..
gcloud builds submit --tag gcr.io/$PROJECT_ID/struct-ai-frontend \
  --dockerfile deployment/Dockerfile.frontend \
  --build-arg REACT_APP_API_BASE_URL=$BACKEND_URL .

gcloud run deploy struct-ai-frontend \
  --image gcr.io/$PROJECT_ID/struct-ai-frontend \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated

echo "✅ Deployment Complete!"
echo "Backend URL:  $BACKEND_URL"
echo "Frontend URL: https://struct-ai-frontend-962155187689.us-central1.run.app"
