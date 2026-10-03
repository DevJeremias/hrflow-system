# Contexto de build: a raiz do repositório (docker-compose.yml: context ../repo, dockerfile deploy/web.Dockerfile).
FROM node:22-bookworm-slim AS build
ENV NODE_OPTIONS=--max-old-space-size=700
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci --workspace frontend
COPY frontend frontend
RUN npm run build --workspace frontend

FROM caddy:2-alpine
COPY --from=build /app/frontend/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
