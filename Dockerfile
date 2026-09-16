# syntax=docker/dockerfile:1.7

# Self-hosted build (see deploy/README.md). Three stages so the runtime
# image carries neither the SSH key used to reach the private domain
# package nor the build toolchain.

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache git openssh-client libc6-compat \
    && mkdir -p -m 0700 ~/.ssh \
    && ssh-keyscan github.com >> ~/.ssh/known_hosts
COPY package.json package-lock.json ./
# @reservaste/domain lives in a private repo (ADR-0016). npm shells out to
# git for a "github:" spec, so the rewrite points it at SSH and the
# forwarded agent supplies the deploy key -- which never lands in a layer.
RUN git config --global url."git@github.com:".insteadOf "https://github.com/"
RUN --mount=type=ssh npm ci --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Public env vars are inlined into the client bundle at build time, so
# they have to be present here and not only at runtime.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
