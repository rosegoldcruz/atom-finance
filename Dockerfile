FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV DATABASE_URL=postgresql://atom@127.0.0.1:5432/atom
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS api
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app /app
# A CRLF checkout turns `set -eu` into `set -eu\r`, and the shell then loops on "Illegal option".
RUN sed -i 's/\r$//' deploy/api-entrypoint.sh && chmod +x deploy/api-entrypoint.sh
EXPOSE 8787
CMD ["sh", "deploy/api-entrypoint.sh"]

FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
