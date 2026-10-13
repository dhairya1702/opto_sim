#!/usr/bin/env bash
set -euo pipefail
PROJECT="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-us-central1}"
VOICE_ENABLED="${VITE_VOICE_ENABLED:-false}"
if [[ "$PROJECT" != "opto-simulator-dhairya" && "$PROJECT" != "opto-simulator-dhairya-514231" ]]; then
  echo "Refusing to deploy unexpected project: $PROJECT" >&2
  exit 1
fi
gcloud builds submit --project="$PROJECT" --config=cloudbuild.yaml --substitutions="_REGION=$REGION,_VOICE_ENABLED=$VOICE_ENABLED"
gcloud run services add-iam-policy-binding opto-platform --project="$PROJECT" --region="$REGION" --member=allUsers --role=roles/run.invoker >/dev/null
URL="$(gcloud run services describe opto-platform --project="$PROJECT" --region="$REGION" --format='value(status.url)')"
gcloud run services update opto-platform --project="$PROJECT" --region="$REGION" --update-env-vars="PUBLIC_ORIGIN=$URL,GOOGLE_CLOUD_PROJECT=$PROJECT,VERTEX_LOCATION=global,VERTEX_LIVE_MODEL=gemini-live-2.5-flash-native-audio,GOOGLE_VOICE_NAME=Charon,VOICE_SESSION_LIMIT_MS=1800000,VOICE_INACTIVITY_LIMIT_MS=300000" --max-instances=2 --min-instances=0 --timeout=3600
echo "$URL"
