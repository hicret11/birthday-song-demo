# Container image for the Remotion render worker.
# Deploy to Fly / Railway / Render. Chromium is downloaded by @remotion/renderer
# on first render; the apt packages below provide the shared libraries it needs.
FROM node:20-bookworm-slim

# Headless-Chromium runtime dependencies.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libpango-1.0-0 libcairo2 libatspi2.0-0 fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# App source.
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# tsx runs the TypeScript server entry directly.
CMD ["npx", "tsx", "server.ts"]
