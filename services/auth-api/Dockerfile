FROM oven/bun:1.3.12

WORKDIR /app

COPY package.json bun.lock ./
COPY services/auth-api/package.json ./services/auth-api/package.json
RUN bun install --frozen-lockfile --production --filter auth-api

COPY shared ./shared
COPY services/auth-api ./services/auth-api

WORKDIR /app/services/auth-api

EXPOSE 4001

CMD ["bun", "run", "start"]
