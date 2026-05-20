FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S mcp && adduser -S -G mcp mcp

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist

USER mcp
EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3100/health || exit 1

CMD ["node", "dist/index.js"]
