FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/package.json
RUN node -e "const fs=require('fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); pkg.workspaces=['apps/api']; delete pkg.dependencies; delete pkg.devDependencies; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));"
RUN corepack enable && yarn install --frozen-lockfile --production=false

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/api/src apps/api/src
RUN yarn workspace api build

FROM base AS runtime
COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/package.json
RUN node -e "const fs=require('fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); pkg.workspaces=['apps/api']; delete pkg.dependencies; delete pkg.devDependencies; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));"
RUN corepack enable && yarn install --frozen-lockfile --production=true
COPY --from=build /app/apps/api/dist apps/api/dist
COPY db/migrations db/migrations

# Run as the unprivileged `node` user (uid 1000, ships with the official
# image) so a container breakout lands as non-root rather than root on the
# box. Ownership is handed over after the root-only install/copy steps.
RUN chown -R node:node /app
USER node

EXPOSE 8080
CMD ["npm", "--workspace", "apps/api", "run", "start:dist"]
