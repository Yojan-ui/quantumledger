# QuantumLedger web + API + Attack Lab engine as one long-running Node service. A real server (not
# serverless) is required: raw TLS scans, the SSE event bus, the live mesh, the in-process Shield
# demo nodes, and the always-on Attack Lab engine all need a persistent process.
#
# Node 24 (OpenSSL 3.5+) so the scanner can always offer the hybrid X25519MLKEM768 key exchange.
#
# Build:  docker build -t q-setu .
# Run:    docker run -p 3000:3000 -v qsetu-data:/data \
#           -e LAB_DEMO_ACCOUNTS=team@quantumledger.dev=team q-setu
FROM node:24-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:24-bookworm-slim
RUN corepack enable && useradd --create-home qsetu && mkdir /data && chown qsetu /data
WORKDIR /app
COPY --from=build --chown=qsetu /app /app
USER qsetu
# The web app on PORT; the Attack Lab engine on LAB_PORT (loopback), reached via ATTACK_LAB_API.
ENV NODE_ENV=production \
    PORT=3000 \
    QSETU_DATA_DIR=/data \
    ATTACK_LAB_DIR=/data/attack-lab \
    ATTACK_LAB_API=http://127.0.0.1:4100 \
    LAB_PORT=4100
VOLUME /data
EXPOSE 3000
# Both processes; if either exits, the container exits so the platform restarts it.
CMD ["node", "scripts/docker-start.mjs"]
