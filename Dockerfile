# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# --ignore-scripts: `prepare` (husky) is a devDependency-only concern and
# isn't installed under --omit=dev, so running it here fails with "husky:
# not found". No runtime dependency needs an install script either.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/build ./build
EXPOSE 3000
USER node
CMD ["node", "build/index.js"]
