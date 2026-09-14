FROM oven/bun:1.3.12

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/habits/package.json ./apps/habits/package.json
COPY apps/tasks/package.json ./apps/tasks/package.json
COPY packages/storage/package.json ./packages/storage/package.json
COPY services/auth-api/package.json ./services/auth-api/package.json
RUN bun install --frozen-lockfile --production --filter auth-api

COPY shared ./shared
COPY services/auth-api ./services/auth-api

WORKDIR /app/services/auth-api

EXPOSE 4001

CMD ["bun", "run", "start"]
