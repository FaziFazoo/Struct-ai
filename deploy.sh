#!/bin/bash
set -e

PROJECT_ID="project-2dc5bd49-c8ce-4889-95a"
REGION="us-central1"

echo "🚀 Starting deployment to Google Cloud Project: $PROJECT_ID"

# 1. Deploy Backend
echo "📦 Building and deploying Backend..."
# We assume we are in the root directory
cd backend
gcloud builds submit --tag gcr.io/$PROJECT_ID/struct-ai-backend
gcloud run deploy struct-ai-backend \
  --image gcr.io/$PROJECT_ID/struct-ai-backend \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$REGION

# Capture the backend URL for the frontend build
BACKEND_URL=$(gcloud run services describe struct-ai-backend --platform managed --region $REGION --format 'value(status.url)')
echo "Found Backend URL: $BACKEND_URL"

# Return to root for frontend build
cd ..

# 2. Deploy Frontend
echo "🎨 Building and deploying Frontend..."
# Dockerfile is in deployment/Dockerfile.frontend relative to root
# The build context '.' is the root
gcloud builds submit --tag gcr.io/$PROJECT_ID/struct-ai-frontend \
  --dockerfile deployment/Dockerfile.frontend \
  --build-arg REACT_APP_API_BASE_URL=$BACKEND_URL .

gcloud run deploy struct-ai-frontend \
  --image gcr.io/$PROJECT_ID/struct-ai-frontend \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated

echo "✅ Deployment Complete!"
echo "Backend: $BACKEND_URL"
echo "Frontend: $(gcloud run services describe struct-ai-frontend --platform managed --region $REGION --format 'value(status.url)')"
