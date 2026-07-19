# Multi-stage build: Bun builds the static bundle, nginx serves it. The runtime image
# carries only the compiled `dist/` + nginx — no Bun, no node_modules, no source.

# --- build stage -----------------------------------------------------------------
FROM oven/bun:1.3-alpine AS build
WORKDIR /app

# Install deps first (cached until the lockfile changes). --frozen-lockfile makes the
# build fail rather than silently drift if bun.lock is out of date.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build the static bundle → /app/dist.
COPY . .
RUN bun run build

# --- serve stage -----------------------------------------------------------------
FROM nginx:alpine AS serve
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
