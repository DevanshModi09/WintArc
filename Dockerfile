# The whole app in one image: the API, plus the built client for it to serve.
# Build with the two public Supabase values the client is compiled against:
#
#   docker build -t wintarc \
#     --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... .
#
# Run with the server's settings (see server/.env.example). Docker reads an
# env file literally, so the values in it must not be wrapped in quotes:
#
#   docker run --env-file prod.env -p 4000:4000 wintarc

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
# Optional: turns on Google's on-page sign-in button.
ARG VITE_GOOGLE_CLIENT_ID
# Generates the Prisma client, type-checks the server and bundles the client.
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci --omit=dev --workspace server && npm cache clean --force
COPY server/src server/src
COPY server/tsconfig.json server/
COPY --from=build /app/server/generated server/generated
COPY --from=build /app/client/dist client/dist

USER node
WORKDIR /app/server
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:${PORT:-4000}/api/health || exit 1
# tsx directly, not through npm, so the container's stop signal reaches the
# server and requests in flight get to finish.
CMD ["node", "--import", "tsx", "src/index.ts"]
