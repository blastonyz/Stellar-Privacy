# Build from repo root so circuit artifacts are included:
#   docker build -f backend/Dockerfile -t shield-backend .
#
# Cloud Run deploy (example):
#   gcloud run deploy shield-backend --source . --dockerfile backend/Dockerfile

FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV VK_BUILD_DIR=/app/circuits/build

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY circuits/build ./circuits/build

EXPOSE 8080

CMD ["node", "dist/index.js"]
