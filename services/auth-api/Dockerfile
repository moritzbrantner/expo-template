FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d

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
