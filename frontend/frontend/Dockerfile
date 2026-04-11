FROM node:22-alpine

WORKDIR /app

# Copy package trước để tận dụng cache
COPY package*.json ./

# Fix network + tăng retry + dùng ci
RUN npm config set registry https://registry.npmjs.org/ \
 && npm config set fetch-retries 5 \
 && npm config set fetch-retry-maxtimeout 600000 \
 && npm ci

# Copy source
COPY . .

# Build Next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]