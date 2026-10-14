# quantumledger/shield: Shield Edge in a container.
#   docker build -f packages/shield-edge/docker/Dockerfile -t quantumledger/shield .
# Built from the repository root (it needs the workspace). The runtime image is Node plus one
# bundled JavaScript file: no package manager, no source, no shell tools beyond the base image.

FROM node:24-bookworm-slim AS build
WORKDIR /src
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @qsetu/shield-edge... \
 && pnpm --filter @qsetu/shield-edge build

FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    EDGE_PORT=8443 \
    EDGE_HTTP_PORT=8080 \
    EDGE_ADMIN=0.0.0.0:9790 \
    EDGE_CERT_DIR=/data/certs
WORKDIR /app
COPY --from=build /src/packages/shield-edge/dist/cli.js /app/edge.mjs
RUN mkdir -p /data/certs && chown -R node:node /data
# Unprivileged ports inside; map 443 → 8443 and 80 → 8080 outside. Runs as the non-root "node" user.
USER node
VOLUME ["/data"]
EXPOSE 8443 8080
# The admin port (metrics, health) is for your private network only: don't publish 9790.
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:9790/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["node", "/app/edge.mjs"]
