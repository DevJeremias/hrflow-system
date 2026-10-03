# Contexto de build: a raiz do repositório (docker-compose.yml: context ../repo, dockerfile deploy/api.Dockerfile).
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci --omit=dev --workspace backend
COPY backend backend
COPY scripts scripts
USER node
WORKDIR /app/backend
# O backend é TypeScript: Node 22.18+ executa .ts com remoção de tipos nativa.
CMD ["node", "server.ts"]
