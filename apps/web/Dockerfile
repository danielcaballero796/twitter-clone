# syntax=docker/dockerfile:1

FROM node:22-slim AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.13.1 --activate || npm install -g pnpm@10.13.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --filter "@twitterclone/web..."

COPY apps/web apps/web
COPY packages/shared packages/shared

ENV VITE_API_URL=""

RUN pnpm --filter @twitterclone/web build

FROM nginx:alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
