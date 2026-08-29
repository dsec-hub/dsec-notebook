# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:24-alpine AS build

# Skip Playwright browser download (only needed for tests, not for building).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=data/dsec.db

COPY --from=build /app/build ./build

RUN mkdir -p data && chown -R node:node /app
USER node

EXPOSE 3000
VOLUME ["/app/data"]

CMD ["node", "build/index.js"]
