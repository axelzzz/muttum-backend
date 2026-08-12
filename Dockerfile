FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build \
  && mkdir -p dist/src/db \
  && cp src/db/schema.sql dist/src/db/schema.sql \
  && cp -r src/db/migrations dist/src/db/migrations

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
