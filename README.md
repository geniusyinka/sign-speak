# SignSpeak

SignSpeak is a real-time accessibility app for two-way communication between Deaf/Hard-of-Hearing signers and hearing speakers. The browser captures sign video frames and microphone audio, the backend interprets each turn with Gemini, and the app returns text plus optional speech so both sides can follow the conversation live.

## Hackathon Requirement Check

- Gemini model: `gemini-2.5-flash` for multimodal sign interpretation and audio transcription, plus Gemini Live for low-latency audio workflows.
- Google GenAI SDK: backend uses `google-genai`.
- Google Cloud service: backend is deployed to Google Cloud Run, with optional Google Cloud Text-to-Speech for server-side voice output.

## Core Features

- Real-time sign-to-text interpretation from short frame sequences instead of single snapshots.
- Speech-to-text transcription for the hearing participant.
- Conversation history that improves turn-level interpretation.
- Inline translation overlays and visual camera guidance for live feedback.
- Optional server-side speech playback using Google Cloud Text-to-Speech.

## Tech Stack

- Frontend: React, TypeScript, Vite, MediaPipe hand landmarks
- Backend: FastAPI, WebSockets, Python
- AI: Gemini via Google GenAI SDK
- Google Cloud: Cloud Run, Cloud Build, Secret Manager, Text-to-Speech

## Repository Structure

```text
frontend/   React client
server/     FastAPI WebSocket backend and deployment config
docs/       Architecture and deployment documentation
```

## How Gemini Is Used

- Sign interpretation: the backend batches recent video frames and sends them to Gemini for multimodal reasoning.
- Speech transcription: the backend sends buffered audio to Gemini and returns text to the frontend.
- Context preservation: recent conversation turns are included in prompts so Gemini can disambiguate short signs and replies.

Key implementation files:

- `server/services/gemini_service.py`
- `server/routers/websocket.py`
- `server/services/tts_service.py`

## Data Sources

- Live webcam frames captured in the browser during a session
- Live microphone audio captured in the browser during a session
- Conversation history stored in memory for the active session
- MediaPipe hand landmark model loaded from Google-hosted model assets in the frontend

No external user dataset is bundled with the project.

## Local Setup

### Prerequisites

- Node.js 20+
- Python 3.11+
- A Gemini API key

### 1. Start the backend

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set the required values in `server/.env`:

```env
GEMINI_API_KEY=your_api_key
GOOGLE_CLOUD_PROJECT=your_gcp_project_id
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:3000
```

Run the API:

```bash
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

Health check:

```bash
curl http://localhost:8080/health
```

### 2. Start the frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The Vite dev server proxies WebSocket traffic from `/ws` to the backend on port `8080`.

## Google Cloud Deployment

Cloud deployment assets live in:

- `server/cloudbuild.yaml`
- `server/service.yaml`
- `docs/deployment.md`

Recommended production shape:

- Backend: Cloud Run
- Frontend: Firebase Hosting or Cloud Storage static hosting
- Secrets: Secret Manager

## Reproducible Deployment Steps

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com texttospeech.googleapis.com
printf '%s' "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
gcloud builds submit --config server/cloudbuild.yaml --substitutions _ALLOWED_ORIGINS=https://YOUR_FRONTEND_HOST .
```

After deployment, point the frontend at the Cloud Run backend URL for WebSocket traffic by setting `VITE_WEBSOCKET_BASE_URL`.

## Testing Instructions

Follow these steps to test SignSpeak Live locally after completing the [Local Setup](#local-setup) above.

### Prerequisites

- A webcam (built-in or external)
- A microphone
- A Gemini API key set in `server/.env`
- Both frontend (port 3000) and backend (port 8080) running

### Test 1: Health Check

```bash
curl http://localhost:8080/health
```

You should see `{"status":"healthy","gemini_configured":true,...}`.

### Test 2: Sign → Speech

1. Open `http://localhost:3000` in Chrome (recommended for WebRTC support).
2. Enter a display name and click **Start Session**.
3. Allow camera and microphone permissions when prompted.
4. Make sure you're in **Sign** mode (hand icon active in the bottom controls).
5. Sign something into the camera — start with a simple sign like waving "hello" or pointing to yourself (I/ME).
6. When you lower your hands, the app will interpret after a short pause (~1 second).
7. You should see:
   - A translation overlay on the camera feed
   - The translation appear in the transcript panel
   - Audio playback of the English translation (if unmuted)

### Test 3: Speech → Sign

1. Switch to **Speak** mode (microphone icon in the bottom controls).
2. Speak a short phrase like "How are you?" into your microphone.
3. You should see:
   - Your speech transcribed in the transcript panel
   - ASL gloss notation displayed below the transcription (e.g., `HOW YOU?`)

### Test 4: Multi-Party Room

1. Open a second browser tab to `http://localhost:3000`.
2. In the first tab, note the room code in the URL (`?room=XXXX`) or create a new room.
3. In the second tab, join the same room code with a different display name.
4. Sign or speak in one tab — the translation should appear in both tabs.

### Test 5: Settings

1. Open the settings panel (gear icon).
2. Try changing:
   - **Voice** — switch between Emma, Ava, James, Michael
   - **Text size** — small / medium / large / xlarge
   - **High contrast** — toggle dark mode
   - **Show ASL gloss** — toggle gloss display for spoken input

### Troubleshooting

- **Camera not working**: Make sure no other app is using the camera. Try Chrome if using another browser.
- **No translations**: Check that `GEMINI_API_KEY` is set correctly in `server/.env` and the health endpoint shows `gemini_configured: true`.
- **No audio playback**: Make sure the mute button (speaker icon) is not active. If server TTS isn't configured, the app falls back to browser speech synthesis.
- **WebSocket disconnects**: Check that the backend is running on port 8080 and CORS is configured (`ALLOWED_ORIGINS=http://localhost:3000` in `server/.env`).

## Architecture

- Diagram source: `docs/architecture.svg`
- Deployment notes: `docs/deployment.md`

## Findings And Learnings

- Multi-frame prompting is materially better than single-frame prompting for sign interpretation.
- Short conversational history improves turn disambiguation without requiring long-term storage.
- Real-time UX matters as much as model quality; inline overlays, readiness states, and success cues make the system feel more trustworthy.
- Cloud Run is a practical fit for a WebSocket-based prototype because it reduces operational overhead while still supporting always-on backend sessions.

## Submission Checklist

- Public code repository: this repository
- Spin-up instructions: this README
- Proof of Google Cloud deployment: record Cloud Run service details, logs, and a live request
- Architecture diagram: `docs/architecture.svg`
- Demo video: under 4 minutes, showing live multimodal interpretation
