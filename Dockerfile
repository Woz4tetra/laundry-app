# --- build the web PWA ---
FROM node:20-bookworm AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
RUN npm run build

# --- install server deps (native better-sqlite3 build) ---
FROM node:20-bookworm AS server-deps
WORKDIR /app/server
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json* ./
RUN npm install

# --- runtime ---
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/server
COPY --from=server-deps /app/server/node_modules ./node_modules
COPY server/ ./
COPY --from=web /app/web/dist /app/web/dist
EXPOSE 8787
CMD ["npm", "start"]
