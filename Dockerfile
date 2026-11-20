# ==============================================================================
# Group 12 — ExamFlow: Online Examination Management System
# Production Multi-Stage Dockerfile (Alpine Linux + Node.js 22 LTS)
# Single Full-Stack Container: Static React Frontend + Express/Node.js Backend
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build the React.js + TypeScript Frontend
# ------------------------------------------------------------------------------
FROM node:22-alpine AS web-builder
WORKDIR /app/web

# Install web dependencies
COPY web/package.json web/package-lock.json* ./
RUN npm install

# Build arguments for Vite frontend configuration
ARG VITE_FIREBASE_API_KEY=""
ARG VITE_FIREBASE_AUTH_DOMAIN="online-examamination.firebaseapp.com"
ARG VITE_FIREBASE_PROJECT_ID="online-examamination"
ARG VITE_FIREBASE_STORAGE_BUCKET="online-examamination.firebasestorage.app"
ARG VITE_FIREBASE_MESSAGING_SENDER_ID="219771742130"
ARG VITE_FIREBASE_APP_ID="1:219771742130:web:5744e7caae7db4944026ab"
ARG VITE_AWS_GRADING_API_URL=""
ARG VITE_GEMINI_API_KEY=""

ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_AWS_GRADING_API_URL=$VITE_AWS_GRADING_API_URL \
    VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

# Copy source and build distribution bundle
COPY web/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Install Production Dependencies for Backend Server
# ------------------------------------------------------------------------------
FROM node:22-alpine AS server-deps
WORKDIR /app/server

COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts

# ------------------------------------------------------------------------------
# Stage 3: Minimal Production Runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=10000 \
    HOST=0.0.0.0

# Copy backend dependencies and code
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/

# Copy compiled frontend from Stage 1
COPY --from=web-builder /app/web/dist ./web/dist

# Security hardening: Run as non-root user 'node'
RUN chown -R node:node /app
USER node

# Expose container port (Render will map this to public traffic)
EXPOSE 10000

# Native Node.js Healthcheck (Zero external package dependencies)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "import('http').then(h => h.get('http://localhost:10000/healthz', r => process.exit(r.statusCode === 200 ? 0 : 1)))" || exit 1

# Start the full-stack server
CMD ["node", "server/index.mjs"]
