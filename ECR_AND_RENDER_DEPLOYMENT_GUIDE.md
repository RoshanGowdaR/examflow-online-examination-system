# Group 12 — Amazon ECR Public & Render Deployment Guide

**Project:** ExamFlow — Online Examination Management System  
**Group:** 12  
**Team Members:** Bharath Kumar S, Hemanth Gowda, Roshan Gowda  
**Official Repository:** `https://github.com/RoshanGowdaR/examflow-online-examination-system.git`

---

## 1. Cloud Architecture & Strategy

Our deployment architecture follows modern cloud-native best practices with zero ongoing compute costs:

```
+-------------------------------------------------------------------------------+
|                             CI / CD & Release Flow                            |
|                                                                               |
|   1. Local Build / GitHub    2. Amazon ECR Public       3. Render Web Service |
|      +----------------+         +----------------+         +---------------+  |
|      |  Docker Build  | ======> | Public Image   | ======> | Web Service   |  |
|      |  Multi-stage   |         | Registry       |  Pull   | Runs Docker   |  |
|      +----------------+  Push   +----------------+         | Container     |  |
|                                                            +---------------+  |
|                                                                    |          |
|                                                                    v          |
|                                                            Public HTTPS URL   |
|                                                       examflow.onrender.com   |
|                                                                    |          |
|                                                   +----------------+          |
|                                                   |                |          |
|                                                   v                v          |
|                                            Firebase Auth     Cloud Firestore  |
+-------------------------------------------------------------------------------+
```

### Architecture Decision: Amazon ECR Public vs. AWS Compute Services

- **Amazon ECR Public** is utilized **strictly as a high-availability container registry** to store and distribute our Docker images globally.
- We **do not deploy to AWS ECS, EC2, EKS or AWS Fargate**. This avoids all container orchestration costs, VPC NAT Gateway charges, and cluster management complexity.
- **Render** executes the Docker container on its Free Tier Web Service, pulling directly from Amazon ECR Public.
- **Firebase** (Spark Plan) provides authentication and serverless Cloud Firestore database services at zero cost.

---

## 2. Part 1: Storing Docker Image in Amazon ECR Public

### Step 1: Install & Configure AWS CLI

Ensure you have the AWS CLI installed:
```bash
aws --version
```

Configure your credentials:
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and Default region (e.g., us-east-1)
```

### Step 2: Authenticate Docker with Amazon ECR Public

> [!IMPORTANT]
> The Amazon ECR Public registry authentication token **must always be requested from the `us-east-1` region**, regardless of your physical location or default AWS region.

Run the following command:

```bash
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws
```

You should see:
```
Login Succeeded
```

### Step 3: Create an ECR Public Repository

Create a public repository named `examflow` (if you haven't created one already in the AWS Console):

```bash
aws ecr-public create-repository \
  --repository-name examflow \
  --region us-east-1
```

Note your **Registry Alias** and the **repositoryUri** from the command output. It looks like:
`public.ecr.aws/a1b2c3d4/examflow`

### Step 4: Tag Your Local Docker Image

Tag your local `examflow:latest` image with the ECR Public repository URI:

```bash
docker tag examflow:latest public.ecr.aws/<your-registry-alias>/examflow:latest
```

Example:
```bash
docker tag examflow:latest public.ecr.aws/g12exam/examflow:latest
```

### Step 5: Push the Image to Amazon ECR Public

Push the tagged container image to Amazon ECR:

```bash
docker push public.ecr.aws/<your-registry-alias>/examflow:latest
```

Once uploaded, verify your image in the AWS Management Console under **Amazon ECR → Public Repositories → examflow**.

---

## 3. Part 2: Deploying the Container to Render

Render provides managed hosting for containerized applications with automatic TLS/SSL, custom domains, and health checks.

### Step 1: Create an Account on Render

Sign up at [https://render.com](https://render.com) (you can sign in using your GitHub account).

### Step 2: Create a New Web Service

1. From the Render Dashboard, click **New +** in the top right.
2. Select **Web Service**.
3. Under the source options, choose **"Deploy an existing image"** (or "Existing Image").
4. In the **Image URL** field, enter your public Amazon ECR image URI:
   ```
   public.ecr.aws/<your-registry-alias>/examflow:latest
   ```
5. Click **Next**.

### Step 3: Configure Service Details

- **Name**: `examflow-online-exam` (or your preferred unique service name)
- **Region**: Choose the closest region (e.g., `Singapore`, `Oregon`, or `Frankfurt`)
- **Instance Type**: Select **Free** ($0 / month)

### Step 4: Configure Health Check Path

1. Expand the **Advanced** section.
2. Find **Health Check Path**.
3. Set the value to:
   ```
   /healthz
   ```
   Render will automatically poll this endpoint to verify that the container is healthy before routing incoming web traffic to it.

### Step 5: Configure Environment Variables

Under the **Environment Variables** section on Render, add the following key-value pairs:

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations in Express and Node. |
| `PORT` | `10000` | Port where Express listens (`0.0.0.0:10000`). |
| `HOST` | `0.0.0.0` | Container network bind address. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `{"type":"service_account",...}` | Minified single-line Firebase Admin credentials JSON. |
| `GEMINI_API_KEY` | `AIzaSy...` | Google Gemini API key for AI exam question generation. |

> [!TIP]
> To minify your `service-account.json` into a single line for Render, you can use PowerShell:
> ```powershell
> (Get-Content -Raw service-account.json | ConvertFrom-Json | ConvertTo-Json -Compress) | Set-Clipboard
> ```
> Then simply paste into the Render Environment Variable value box.

### Step 6: Deploy Service

Click **Create Web Service**.

Render will:
1. Pull the Docker image directly from Amazon ECR Public.
2. Initialize and start the container using non-root user `node`.
3. Probe `GET /healthz`.
4. Issue an automatic HTTPS/TLS certificate.
5. Provide your live web address (e.g., `https://examflow-online-exam.onrender.com`).

---

## 4. Part 3: Post-Deployment Verification

Once Render displays **"Service is live"**, complete these verification checks:

### 1. Test Health Check Endpoint

```bash
curl https://examflow-online-exam.onrender.com/healthz
```

Expected output:
```json
{"status":"ok","service":"examflow-online-exam","timestamp":"...","uptimeSeconds":12}
```

### 2. Test Client Application Loading

Open `https://examflow-online-exam.onrender.com` in your browser:
- Confirm the ExamFlow sign-in screen renders cleanly.
- Open DevTools (F12) -> Console: confirm 0 runtime errors.
- Network tab: verify static assets (`/assets/*.js`, `/assets/*.css`) load with HTTP 200.

### 3. Test Authentication & Dashboard Access

- Sign in as an Admin (`gowdaroshan49@gmail.com`).
- Verify navigation to `/dashboard`.
- Test Faculty Management: open "+ Create Faculty" and test validation.
- Test Student Management: open "+ Create Student" and verify course/department association.
- Test AI Exam Generator: click "+ AI Generate Exam" and generate sample questions with Gemini API.

---

## 5. Ongoing Updates and Re-deployments

Whenever new code or updates are prepared:

1. Build the updated Docker image locally:
   ```bash
   docker build -t examflow:latest .
   ```
2. Re-tag for Amazon ECR Public:
   ```bash
   docker tag examflow:latest public.ecr.aws/<your-registry-alias>/examflow:latest
   ```
3. Push to ECR Public:
   ```bash
   docker push public.ecr.aws/<your-registry-alias>/examflow:latest
   ```
4. On Render: Go to your Web Service dashboard -> click **Manual Deploy** -> **Deploy latest image**.
