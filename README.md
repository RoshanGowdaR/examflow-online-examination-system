# ExamFlow — Online Examination Management System

**Group:** 12  
**Team Members:** Bharath Kumar S, Hemanth Gowda, Roshan Gowda  
**Official GitHub Repository:** [https://github.com/RoshanGowdaR/examflow-online-examination-system.git](https://github.com/RoshanGowdaR/examflow-online-examination-system.git)

---

## 1. Project Overview

**ExamFlow** is a modern, enterprise-ready, role-based online examination management platform built to simplify, automate, and secure academic assessments. The platform supports complete hierarchical user administration (Admin → Faculty → Student), AI-assisted question and examination generation powered by the Google Gemini API, server-side automated grading with tamper-proof answer keys, and a unified full-stack Docker container architecture designed for zero-cost deployment via Amazon ECR Public and Render.

---

## 2. System Architecture & Tech Stack

```
+-----------------------------------------------------------------------------------------+
|                                ExamFlow Cloud Architecture                              |
|                                                                                         |
|       [ Client Browser ]                                                                |
|               |                                                                         |
|               v (HTTPS)                                                                 |
|  +-----------------------------------------------------------------------------------+  |
|  | Render Web Service (Free Tier)                                                    |  |
|  | +-------------------------------------------------------------------------------+ |  |
|  | | Docker Container (Alpine Linux + Node.js 22 LTS)                              | |  |
|  | |                                                                               | |  |
|  | |  [ React 19 + TypeScript SPA ] <=====> [ Express.js Backend Server (:10000) ] | |  |
|  | |    - Lucide React Icons                  - Automated Server-side Grading      | |  |
|  | |    - Tailwind-styled UI                  - Trusted User Management API        | |  |
|  | |    - Client Routing (React Router v7)    - Gemini AI Exam Generation Engine   | |  |
|  | |                                          - Docker Healthcheck (/healthz)      | |  |
|  | +-------------------------------------------------------------------------------+ |  |
|  +-----------------------------------------------------------------------------------+  |
|             |                                        |                                  |
|             v                                        v                                  |
|   [ Firebase Authentication ]              [ Cloud Firestore (Spark) ]                  |
|   - Secure Role-based Identity             - User Profiles & Roles                      |
|   - Password Setup & Reset Links           - Courses & Scheduled Exams                  |
|                                            - Isolated Answer Keys (Server Only)         |
|                                            - Student Results & Submissions              |
|                                                                                         |
|       [ Amazon ECR Public ]                      [ Google Gemini API ]                  |
|   - High-Availability Docker Registry       - AI Exam Question Generation               |
+-----------------------------------------------------------------------------------------+
```

### Core Technologies

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React Icons, React Router v7.
- **Backend Server:** Node.js 22, Express.js, Firebase Admin SDK, Google Gen AI SDK.
- **Authentication:** Firebase Authentication (Strict role enforcement, zero public sign-ups).
- **Persistent Database:** Firebase Cloud Firestore (Spark Free Plan, custom security rules).
- **AI Assessment Engine:** Google Gemini API (Structured JSON question generation).
- **Containerization:** Multi-stage Dockerfile (Alpine Linux, non-root `node` execution).
- **Container Registry:** Amazon ECR Public (Image storage and global distribution).
- **Application Hosting:** Render Web Services (Automatic TLS/SSL, health checking, free tier).

---

## 3. Key Platform Capabilities

### A. Hierarchical Role-Based Access Control

1. **Administrator (Super Admin)**
   - Complete system governance and oversight.
   - Dedicated **Faculty Management** section with `+ Create Faculty` modal (full name, email, employee ID, department, assigned courses, contact number).
   - Dedicated **Student Management** section with `+ Create Student` modal.
   - Course and subject catalog management.
   - System-wide examination and analytics reporting.
2. **Faculty**
   - Course-level administration and student management for permitted departments/courses.
   - Examination authoring with manual question builder and question bank management.
   - **AI Exam Generator** (`+ AI Generate Exam`): Generates syllabus-aligned multiple-choice, multiple-answer, and true/false questions with difficulty calibration and explanations.
   - Examination publication and automatic answer key synchronization to server-only storage.
   - Student submission evaluation and analytics.
3. **Student**
   - Clean, distraction-free dashboard showing assigned, upcoming, and completed exams.
   - Timed exam attempt interface with auto-save and submission safeguards.
   - Instant scorecard and performance feedback once graded.

### B. Anti-Cheat & Secure Server-Side Grading

- **Zero Client Answer Leaks:** Correct answers are never sent to student browser clients. They are stored in isolated `/answerKeys/{examId}` documents locked by Firestore rules (`allow read, write: if false`).
- **Cryptographic ID Token Verification:** Every backend mutation requires a cryptographically validated Firebase ID token in the `Authorization: Bearer <token>` header.
- **Automated Score Calculation:** The backend compares answers against secure answer keys and records tamper-proof results directly in `/results`.

---

## 4. Documentation Guides

For in-depth operational instructions, refer to our specialized guides:

1. [**Docker Implementation Guide**](file:///c:/Users/gowda/OneDrive/Desktop/group12-online-exam-starter/DOCKER_IMPLEMENTATION_GUIDE.md) — Multi-stage build details, local running, container testing, and troubleshooting.
2. [**Amazon ECR & Render Deployment Guide**](file:///c:/Users/gowda/OneDrive/Desktop/group12-online-exam-starter/ECR_AND_RENDER_DEPLOYMENT_GUIDE.md) — AWS CLI ECR Public authentication, image push, Render Web Service setup, and zero-cost cloud operations.
3. [**Production Environment Setup**](file:///c:/Users/gowda/OneDrive/Desktop/group12-online-exam-starter/PRODUCTION_ENVIRONMENT_SETUP.md) — Firebase Spark plan zero-cost guidelines, Admin SDK credentials minification, Gemini API setup, and Firestore security rules.

---

## 5. Quick Start (Local Development)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/RoshanGowdaR/examflow-online-examination-system.git
cd examflow-online-examination-system

# Install backend dependencies
cd server && npm install && cd ..

# Install frontend dependencies
cd web && npm install && cd ..
```

### 2. Configure Environment

Copy `.env.example` in `web/`:
```bash
cp web/.env.example web/.env
```
Fill in your Firebase web app keys.

### 3. Start Local Frontend & Backend

In Terminal 1 (Backend API):
```bash
node server/index.mjs
```

In Terminal 2 (Vite Development Server):
```bash
npm --prefix web run dev
```

Visit `http://localhost:5173` in your browser.

---

## 6. Docker & Container Execution

### Build Docker Image

```bash
docker build -t examflow:latest .
```

### Run via Docker Compose

```bash
docker compose up -d --build
```

Access the application at `http://localhost:8080`.

Test the health check:
```bash
curl http://localhost:8080/healthz
```

---

## 7. Amazon ECR Public & Render Deployment Summary

```bash
# 1. Authenticate with Amazon ECR Public (must use us-east-1)
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws

# 2. Tag image for ECR Public
docker tag examflow:latest public.ecr.aws/<your-registry-alias>/examflow:latest

# 3. Push to ECR Public
docker push public.ecr.aws/<your-registry-alias>/examflow:latest
```

On **Render**:
1. Create a new **Web Service** → Select **"Deploy an existing image"**.
2. Enter image URI: `public.ecr.aws/<your-registry-alias>/examflow:latest`.
3. Set **Health Check Path** to `/healthz`.
4. Configure environment variables (`PORT=10000`, `NODE_ENV=production`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `GEMINI_API_KEY`).
5. Deploy service at zero cost.

---

## 8. Git Safety & Secrets Protection

- `.env` files and Firebase service-account JSON keys are excluded by `.gitignore` and `.dockerignore`.
- Never commit private keys, credentials, or `.env` files to GitHub.
- Cloud deployment credentials should only be supplied as encrypted environment variables in the Render dashboard.

---

*Group 12 — Department of Computer Science & Engineering*
