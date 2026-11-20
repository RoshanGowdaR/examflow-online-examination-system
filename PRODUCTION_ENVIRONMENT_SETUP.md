# Group 12 — Production Environment & Zero-Cost Configuration Setup

**Project:** ExamFlow — Online Examination Management System  
**Group:** 12  
**Team Members:** Bharath Kumar S, Hemanth Gowda, Roshan Gowda  
**Official Repository:** `https://github.com/RoshanGowdaR/examflow-online-examination-system.git`

---

## 1. Zero-Cost Architectural Philosophy

ExamFlow is designed intentionally for zero operational cost, operating comfortably within free tier allowances:

| Component | Service | Free Allowance Tier | Cost |
| :--- | :--- | :--- | :--- |
| **Container Registry** | Amazon ECR Public | 50 GB free storage / month | **$0.00** |
| **App Execution** | Render Web Services | 750 free instance hours / month | **$0.00** |
| **Authentication** | Firebase Authentication | 50,000 monthly active users | **$0.00** |
| **Cloud Database** | Firebase Cloud Firestore | Spark Plan (50K reads/day, 20K writes/day, 1GB data) | **$0.00** |
| **AI Assessment Engine** | Google Gemini API | Free Tier (15 RPM / 1M TPM) | **$0.00** |
| **Source Control** | GitHub | Unlimited public / private repositories | **$0.00** |

---

## 2. Firebase Configuration (Spark Free Plan)

### Step 1: Firebase Project Setup

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your existing project: `online-examamination`.
3. In **Authentication → Sign-in method**:
   - Ensure **Email/Password** is enabled.
   - Leave "Email link (passwordless sign-in)" disabled.

### Step 2: Download Firebase Admin SDK Service Account

To perform trusted server-side operations (creating faculty/student accounts, evaluating submissions, creating secure answer keys):

1. Go to **Project Settings** (gear icon) → **Service accounts**.
2. Click **Generate new private key** and confirm **Generate key**.
3. A JSON file will download (e.g. `online-examamination-firebase-adminsdk-*.json`).
4. **CRITICAL SECURITY RULE:** Never commit this file or paste its raw content into public files.

### Step 3: Compress JSON for Render / Docker Environment Variable

On Windows PowerShell:
```powershell
$json = Get-Content -Raw "path\to\downloaded-key.json" | ConvertFrom-Json | ConvertTo-Json -Compress
$json | Set-Clipboard
```
This copies a single-line minified JSON string directly to your clipboard, ready to paste as `FIREBASE_SERVICE_ACCOUNT_JSON` on Render or in your local `.env`.

---

## 3. Google Gemini API Key Setup

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **Get API key** → **Create API key in new project** (or select your existing project).
4. Copy the API key string (e.g., `AIzaSy...`).
5. Store this string as `GEMINI_API_KEY` in:
   - Your local `.env` (for local development and testing)
   - Your Render Web Service environment variables

---

## 4. Firestore Security Rules Deployment

Deploy the battle-tested, least-privilege security rules directly in **Firebase Console → Firestore Database → Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }
    function myUser() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    function isActive() {
      return signedIn() && myUser().active == true;
    }
    function isAdmin() {
      return isActive() && myUser().role == 'admin';
    }
    function isFaculty() {
      return isActive() && (myUser().role == 'faculty' || myUser().role == 'admin');
    }

    match /users/{uid} {
      allow read: if signedIn() && (
        request.auth.uid == uid ||
        isAdmin() ||
        (isFaculty() && resource.data.role == 'student')
      );
      allow create, update, delete: if isAdmin();
    }

    match /courses/{courseId} {
      allow read: if isActive();
      allow create, update, delete: if isFaculty();
    }

    match /exams/{examId} {
      allow read: if isFaculty() || (isActive() && resource.data.status == 'published');
      allow create, update, delete: if isFaculty();

      match /questions/{questionId} {
        allow read: if isFaculty() || (
          isActive() &&
          get(/databases/$(database)/documents/exams/$(examId)).data.status == 'published'
        );
        allow create, update, delete: if isFaculty();
      }
    }

    match /answerKeys/{examId} {
      allow read, write: if false; // Server-side admin only
    }

    match /results/{resultId} {
      allow read: if isActive() && (
        isFaculty() || resource.data.studentUid == request.auth.uid
      );
      allow create, update, delete: if false; // Server-side admin only
    }

    match /auditEvents/{eventId} {
      allow read, write: if false; // Server-side admin only
    }
  }
}
```

---

## 5. Bootstrapping Your First Admin User

To establish the initial Super Admin account without relying on public registration:

1. In **Firebase Console → Authentication → Users**, find or create `gowdaroshan49@gmail.com`.
2. Copy the **User UID** from the Authentication table.
3. In **Firestore Database → Data**, navigate to the `users` collection (create it if not present).
4. Click **Add document**:
   - **Document ID**: Paste the exact **User UID** copied from step 2.
   - Add fields:
     - `uid` (string): same User UID
     - `name` (string): `Roshan Gowda`
     - `email` (string): `gowdaroshan49@gmail.com`
     - `role` (string): `admin`
     - `active` (boolean): `true`
5. Save the document.
6. Now you can sign in via the login screen. You will have full access to:
   - Faculty Management (`+ Create Faculty`)
   - Student Management (`+ Create Student`)
   - Course Management
   - AI Examination Generator (`+ AI Generate Exam`)
