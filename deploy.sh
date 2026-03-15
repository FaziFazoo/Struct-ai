#!/bin/bash
set -e

PROJECT_ID="project-2dc5bd49-c8ce-4889-95a"
REGION="us-central1"

# Attempt to find gcloud if it's not in the PATH (especially for Windows bash)
if ! command -v gcloud &> /dev/null; then
    echo "🔍 gcloud not found in PATH, searching in common Windows locations..."
    GCLOUD_PATHS=(
        "$HOME/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud"
        "/c/Users/$USER/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud"
        "/c/Program Files (x86)/Google/Cloud SDK/google-cloud-sdk/bin/gcloud"
        "/c/Program Files/Google/Cloud SDK/google-cloud-sdk/bin/gcloud"
    )
    for path in "${GCLOUD_PATHS[@]}"; do
        if [ -f "$path" ]; then
            alias gcloud="$path"
            echo "✅ Found gcloud at: $path"
            break
        fi
    done
fi

# Fallback for systems where alias doesn't work in scripts
if ! command -v gcloud &> /dev/null && [ -n "$path" ]; then
    gcloud() { "$path" "$@"; }
fi

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

# Dynamically fetch the newly deployed backend URL
BACKEND_URL=$(gcloud run services describe struct-ai-backend --region $REGION --format="value(status.url)")
if [ -z "$BACKEND_URL" ]; then
  echo "❌ Failed to retrieve Backend URL! Using fallback."
  BACKEND_URL="https://struct-ai-backend-jwpcarpvka-uc.a.run.app"
fi

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
echo "   Frontend → $(gcloud run services describe struct-ai-frontend --region $REGION --format='value(status.url)')"
