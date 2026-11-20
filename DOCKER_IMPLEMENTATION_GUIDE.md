# Group 12 — ExamFlow: Docker Containerization Implementation Guide

**Project:** ExamFlow — Online Examination Management System  
**Group:** 12  
**Team Members:** Bharath Kumar S, Hemanth Gowda, Roshan Gowda  
**Official Repository:** `https://github.com/RoshanGowdaR/examflow-online-examination-system.git`

---

## 1. Overview and Container Architecture

ExamFlow is containerized into a single, production-grade, multi-stage Docker container that bundles both the React.js frontend and the Express/Node.js backend API:

```
+--------------------------------------------------------------------------+
|                     ExamFlow Single Container (:10000)                  |
|                                                                          |
|  +-------------------------+          +-------------------------------+  |
|  |    React.js Frontend    |          |    Node.js Express Server     |  |
|  |     (Compiled SPA)      | <======> |   (API Routes + Static Host)  |  |
|  |       web/dist/*        |          |        server/index.mjs       |  |
|  +-------------------------+          +-------------------------------+  |
|               |                                       |                  |
|               v                                       v                  |
|       Client Browser                      Firebase Admin / Firestore     |
|   (Vite static assets)                    Gemini AI Integration API      |
+--------------------------------------------------------------------------+
```

### Multi-Stage Build Stages

1. **Stage 1 (`web-builder`)**:
   - Base image: `node:22-alpine`
   - Installs client dependencies in `web/`
   - Injects `VITE_FIREBASE_*` build arguments
   - Executes `npm run build` (`tsc -b && vite build`) to generate `web/dist`
2. **Stage 2 (`server-deps`)**:
   - Base image: `node:22-alpine`
   - Installs lean production-only dependencies (`express`, `cors`, `firebase-admin`) without devDependencies or build tools
3. **Stage 3 (`runner`)**:
   - Base image: `node:22-alpine`
   - Copies production server dependencies and source code
   - Copies the compiled frontend bundle into `web/dist`
   - Drops root privileges to the built-in non-root user `node` for enterprise container security
   - Exposes container port `10000`
   - Implements native Docker `HEALTHCHECK` probing `http://localhost:10000/healthz`

---

## 2. Prerequisites

- **Docker Desktop** installed on Windows/macOS or **Docker Engine** on Linux.
- Windows users: Ensure Docker Desktop is running with either WSL2 or Hyper-V backend.
- Firebase project credentials (Web app config + Firebase Admin Service Account JSON).

---

## 3. Local Docker Build Commands

### Standard Build

From the root of the repository:

```bash
docker build -t examflow:latest .
```

### Build with Vite Environment Variables

If your Firebase project configuration is ready at build time:

```bash
docker build \
  --build-arg VITE_FIREBASE_API_KEY="AIzaSy..." \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN="online-examamination.firebaseapp.com" \
  --build-arg VITE_FIREBASE_PROJECT_ID="online-examamination" \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET="online-examamination.firebasestorage.app" \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="123456789" \
  --build-arg VITE_FIREBASE_APP_ID="1:123456789:web:abcdef" \
  -t examflow:latest .
```

---

## 4. Running the Container Locally

### Running via `docker run`

Run the container mapping host port `8080` to container port `10000`:

```bash
docker run -d \
  --name examflow_app \
  -p 8080:10000 \
  -e PORT=10000 \
  -e NODE_ENV=production \
  -e FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' \
  -e GEMINI_API_KEY="AIzaSy..." \
  examflow:latest
```

### Running via Docker Compose

1. Copy `.env.example` to `.env` in the repository root:
   ```bash
   cp .env.example .env
   ```
2. Fill in your environment variables in `.env`.
3. Start the application:
   ```bash
   docker compose up -d --build
   ```
4. Check running containers:
   ```bash
   docker compose ps
   ```
5. View container logs in real time:
   ```bash
   docker compose logs -f
   ```
6. Stop the containers:
   ```bash
   docker compose down
   ```

---

## 5. Verification and Testing

### 1. Health Check Verification

Test that the container's health check endpoint responds:

```bash
curl http://localhost:8080/healthz
```

Expected JSON response:
```json
{
  "status": "ok",
  "service": "examflow-online-exam",
  "timestamp": "2026-11-20T16:30:00.000Z",
  "uptimeSeconds": 15
}
```

### 2. Frontend Browser Access

Open your web browser and navigate to:
```
http://localhost:8080
```
- Verify that the ExamFlow sign-in page loads.
- Confirm all static assets (CSS, JS, icons) are served with HTTP 200.
- Test client-side routing by navigating to `/login` or `/dashboard`.

### 3. API Endpoints

- `GET /healthz` — Container and process health check.
- `POST /api/publish` — Publish examination and generate server-side answer keys.
- `POST /api/submit` — Student exam submission and automated grading.
- `POST /api/users/create-faculty` — Admin creates faculty account and sends reset email.
- `POST /api/users/create-student` — Faculty creates student account.
- `POST /api/ai/generate-exam` — AI examination generator powered by Gemini API.

---

## 6. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `docker: error during connect: ... npipe:////./pipe/dockerDesktopLinuxEngine` | Docker Desktop is not running on Windows | Open the Start Menu, launch Docker Desktop, and wait for the status indicator to turn green. |
| `bind: address already in use: 8080` | Host port 8080 is in use by another service | Map to a different host port: `-p 9000:10000` or change `ports:` in `docker-compose.yml`. |
| `Firebase is not configured` in browser | Vite build arguments were not supplied during `docker build` | Supply `--build-arg VITE_FIREBASE_API_KEY=...` during build or ensure `.env` is populated before compose build. |
| Container status `unhealthy` | Server failed to bind to `0.0.0.0` or crashed on startup | Run `docker logs examflow_app` to inspect stack traces. Check if `FIREBASE_SERVICE_ACCOUNT_JSON` is valid JSON. |
