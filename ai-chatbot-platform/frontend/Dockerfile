FROM node:22-alpine
WORKDIR /app
COPY package.json tsconfig.json next.config.ts postcss.config.mjs tailwind.config.ts ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
