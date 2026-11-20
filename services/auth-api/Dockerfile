FROM oven/bun:1.4.5@sha256:3aa040e5445efa09d75bb428a64ba50db13e2b3ac9b6b0c7f145615f62b2ee18

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
