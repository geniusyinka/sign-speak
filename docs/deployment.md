# Google Cloud Deployment

This project is designed to run the backend on Google Cloud Run and use Gemini through the Google GenAI SDK.

## Services Used

- Cloud Run for the FastAPI WebSocket backend
- Cloud Build for container builds and deployments
- Secret Manager for `GEMINI_API_KEY`
- Cloud Text-to-Speech for optional server-generated audio

## 1. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  texttospeech.googleapis.com
```

## 2. Create the Gemini Secret

```bash
printf '%s' "$GEMINI_API_KEY" | \
  gcloud secrets create gemini-api-key --data-file=-
```

If the secret already exists:

```bash
printf '%s' "$GEMINI_API_KEY" | \
  gcloud secrets versions add gemini-api-key --data-file=-
```

## 3. Deploy the Backend

From the repository root:

```bash
gcloud builds submit --config server/cloudbuild.yaml .
```

This builds the container image and deploys `signspeak-backend` to Cloud Run.

If your frontend is hosted on a public domain, pass it into Cloud Build so the backend CORS list matches production:

```bash
gcloud builds submit \
  --config server/cloudbuild.yaml \
  --substitutions _ALLOWED_ORIGINS=https://YOUR_FRONTEND_HOST .
```

## 4. Verify Deployment

Get the deployed URL:

```bash
gcloud run services describe signspeak-backend \
  --region us-central1 \
  --format='value(status.url)'
```

Check health:

```bash
curl "$(gcloud run services describe signspeak-backend \
  --region us-central1 \
  --format='value(status.url)')/health"
```

Tail logs:

```bash
gcloud run services logs read signspeak-backend --region us-central1 --limit 50
```

## 5. Frontend Configuration

For local development, Vite proxies `/ws` traffic to the local backend.

For production, set the frontend WebSocket base URL to the Cloud Run backend, for example:

```text
wss://signspeak-backend-xxxxx-uc.a.run.app
```

In the frontend:

```bash
cd frontend
cp .env.example .env.local
```

Then set:

```env
VITE_WEBSOCKET_BASE_URL=wss://signspeak-backend-xxxxx-uc.a.run.app
```

If the frontend is hosted on Firebase Hosting or another static host, allow that origin in the backend CORS configuration.

## Suggested Proof Recording

Record a short clip showing:

1. The Cloud Run service details page for `signspeak-backend`
2. The live revision or logs
3. A request to `/health`
4. A working browser session hitting the deployed backend

That is enough to satisfy the backend-on-Google-Cloud proof requirement.
