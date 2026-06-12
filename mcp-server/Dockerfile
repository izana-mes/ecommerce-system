# FIX H6: Bumped from node:20-alpine to node:22-alpine to match the Node 22
# version used by the CI workflow (ai-mcp-ci.yml). Using different runtimes
# between build and CI creates a parity gap that can hide runtime bugs.
#
# FIX M4: Use `npm ci` (not `npm install`) in deps stage for reproducible,
# deterministic dependency resolution.
FROM node:22-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S mcp && adduser -S -G mcp mcp

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist

USER mcp
EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3100/health || exit 1

CMD ["node", "dist/index.js"]
