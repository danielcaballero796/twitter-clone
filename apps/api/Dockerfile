# syntax=docker/dockerfile:1

FROM node:22-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/prisma ./apps/api/prisma

RUN pnpm install --frozen-lockfile --filter "@twitterclone/api..."

COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

RUN pnpm --filter @twitterclone/api build
RUN pnpm --filter @twitterclone/shared exec tsc src/index.ts --outDir src --module commonjs --target es2022 --skipLibCheck

FROM node:22-slim AS runtime
WORKDIR /app/apps/api

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages /app/packages
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./package.json

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
