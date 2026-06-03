#!/bin/bash
# Deploy JusticeQueue MCP server to Cloud Run
# Usage: MDB_URI="mongodb+srv://..." PROJECT_ID="your-project" ./deploy.sh

set -e

PROJECT_ID="${PROJECT_ID:?'Set PROJECT_ID'}"
MDB_URI="${MDB_URI:?'Set MDB_URI'}"
MCP_SECRET="${MCP_SECRET:?'Set MCP_SECRET — a random string, e.g.: openssl rand -hex 24'}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="justicequeue-mcp"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "Building image..."
gcloud builds submit . --tag "$IMAGE" --project "$PROJECT_ID"

echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --set-env-vars "MDB_MCP_CONNECTION_STRING=${MDB_URI},MCP_SECRET=${MCP_SECRET}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --min-instances 1 \
  --max-instances 10 \
  --project "$PROJECT_ID"

echo ""
echo "Done. Set these in Vercel environment variables:"
echo "  MCP_SERVER_URL=https://${SERVICE_NAME}-*.run.app"
echo "  MCP_SECRET=${MCP_SECRET}"
