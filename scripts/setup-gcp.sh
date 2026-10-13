#!/usr/bin/env bash
set -euo pipefail

PRIMARY_PROJECT="opto-simulator-dhairya"
FALLBACK_PROJECT="opto-simulator-dhairya-514231"
REGION="us-central1"
REPOSITORY="opto-platform"
BILLING_NAME="My Billing Account"

ACCOUNT="$(gcloud config get-value account 2>/dev/null)"
if [[ "$ACCOUNT" != "dhairya.lalwani2001@gmail.com" ]]; then
  echo "Expected gcloud account dhairya.lalwani2001@gmail.com; active account is $ACCOUNT" >&2
  exit 1
fi

PROJECT="$PRIMARY_PROJECT"
if ! gcloud projects describe "$PROJECT" >/dev/null 2>&1; then
  if ! gcloud projects create "$PROJECT" --name="Opto Simulator"; then
    PROJECT="$FALLBACK_PROJECT"
    gcloud projects describe "$PROJECT" >/dev/null 2>&1 || gcloud projects create "$PROJECT" --name="Opto Simulator"
  fi
fi

BILLING_ID="$(gcloud billing accounts list --filter="displayName='$BILLING_NAME' AND open=true" --format='value(name.basename())' --limit=1)"
if [[ -z "$BILLING_ID" ]]; then echo "Open billing account '$BILLING_NAME' was not found." >&2; exit 1; fi
gcloud billing projects link "$PROJECT" --billing-account="$BILLING_ID"
gcloud config set project "$PROJECT"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com aiplatform.googleapis.com speech.googleapis.com texttospeech.googleapis.com secretmanager.googleapis.com billingbudgets.googleapis.com
gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" >/dev/null 2>&1 || gcloud artifacts repositories create "$REPOSITORY" --location="$REGION" --repository-format=docker --description="Opto Cloud Run images"

COOKIE_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(48).toString("base64url"))')"
for SECRET in opto-voice-cookie-secret; do
  gcloud secrets describe "$SECRET" >/dev/null 2>&1 || gcloud secrets create "$SECRET" --replication-policy=automatic
done
printf '%s' "$COOKIE_SECRET" | gcloud secrets versions add opto-voice-cookie-secret --data-file=-

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
RUN_IDENTITY="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding opto-voice-cookie-secret --member="serviceAccount:$RUN_IDENTITY" --role=roles/secretmanager.secretAccessor
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$RUN_IDENTITY" --role=roles/aiplatform.user
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$RUN_IDENTITY" --role=roles/speech.client
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$RUN_IDENTITY" --role=roles/serviceusage.serviceUsageConsumer

if ! gcloud billing budgets list --billing-account="$BILLING_ID" --filter="displayName='Opto Simulator monthly budget'" --format='value(displayName)' | grep -q .; then
  gcloud billing budgets create --billing-account="$BILLING_ID" --display-name="Opto Simulator monthly budget" --budget-amount=25USD --filter-projects="projects/$PROJECT_NUMBER" --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0
fi
echo "GCP foundation ready: $PROJECT ($REGION)"
