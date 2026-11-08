# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
LABEL org.opencontainers.image.source=https://github.com/eric-maydeck/bean-tracker
WORKDIR /app
ENV NODE_ENV=production
# --ignore-scripts: `prepare` (husky) is a devDependency-only concern and
# isn't installed under --omit=dev, so running it here fails with "husky:
# not found". No runtime dependency needs an install script either.
COPY package.json package-lock.json ./
# The runtime never calls npm; dropping it keeps its bundled dependencies out of the image (and its CVE scan).
RUN npm ci --omit=dev --ignore-scripts \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /app/build ./build
EXPOSE 3000
USER node
CMD ["node", "build/index.js"]
