#!/bin/bash
set -e

PROJECT_ID="project-2dc5bd49-c8ce-4889-95a"
REGION="us-central1"
BACKEND_URL="https://struct-ai-backend-962155187689.us-central1.run.app"

echo "🚀 Deploying to Google Cloud Project: $PROJECT_ID"

# ── 1. Deploy Backend ──────────────────────────────────────────────────────────
echo "📦 [1/2] Building and deploying Backend..."
cd backend
gcloud builds submit --tag gcr.io/$PROJECT_ID/struct-ai-backend
gcloud run deploy struct-ai-backend \
  --image gcr.io/$PROJECT_ID/struct-ai-backend \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$REGION
cd ..

echo "✅ Backend deployed: $BACKEND_URL"

# ── 2. Deploy Frontend ─────────────────────────────────────────────────────────
echo "🎨 [2/2] Building and deploying Frontend..."
# Use cloudbuild.frontend.yaml — this uses gcloud's native --substitutions flag
# to correctly pass --build-arg to Docker during the build step
gcloud builds submit \
  --config deployment/cloudbuild.frontend.yaml \
  --substitutions _REACT_APP_API_BASE_URL=$BACKEND_URL \
  .

gcloud run deploy struct-ai-frontend \
  --image gcr.io/$PROJECT_ID/struct-ai-frontend \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated

echo "✅ Deployment Complete!"
echo "   Backend  → $BACKEND_URL"
echo "   Frontend → https://struct-ai-frontend-962155187689.us-central1.run.app"
