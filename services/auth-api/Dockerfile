FROM oven/bun:1.3.12@sha256:8956c7667fa17beb6e3c664115e66bdacfe502da5d99603626e74c197bdef160

WORKDIR /app

COPY package.json bun.lock ./
COPY services/auth-api/package.json ./services/auth-api/package.json
RUN --mount=type=bind,source=apps,target=/app/apps,readonly \
    --mount=type=bind,source=packages,target=/app/packages,readonly \
    bun install --frozen-lockfile --production --filter auth-api

COPY shared ./shared
COPY services/auth-api ./services/auth-api

WORKDIR /app/services/auth-api

EXPOSE 4001

CMD ["bun", "run", "start"]
