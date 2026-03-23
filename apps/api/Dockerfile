FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
RUN npm ci --workspace apps/api --include-workspace-root=false --include=dev

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/api/src apps/api/src
RUN npm --workspace apps/api run build

FROM base AS runtime
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
RUN npm ci --omit=dev --workspace apps/api --include-workspace-root=false
COPY --from=build /app/apps/api/dist apps/api/dist
COPY db/migrations db/migrations

EXPOSE 8080
CMD ["npm", "--workspace", "apps/api", "run", "start:dist"]
