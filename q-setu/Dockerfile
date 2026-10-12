# QuantumLedger web + API as one long-running Node service (the SSE event bus, the live mesh and the
# in-process Shield demo nodes need a real server, not serverless functions).
# Build:  docker build -t q-setu .
# Run:    docker run -p 3000:3000 -e QSETU_KMS_KEK=$(openssl rand -hex 32) -v qsetu-data:/data q-setu
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:22-bookworm-slim
RUN corepack enable && useradd --create-home qsetu && mkdir /data && chown qsetu /data
WORKDIR /app
COPY --from=build --chown=qsetu /app /app
USER qsetu
ENV NODE_ENV=production QSETU_DATA_DIR=/data PORT=3000
VOLUME /data
EXPOSE 3000
CMD ["pnpm", "--filter", "@qsetu/web", "start"]
