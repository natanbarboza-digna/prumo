# Prumo production image (plan 014). Two final targets:
# - runner: the app itself (Next's standalone server, small, no dev tools);
# - tools:  full dependencies and source, for migrations, the default
#           categories seed and the account script (`npm run auth:create-user`).

FROM node:26-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- Dependencies ------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
COPY scripts/enable-git-hooks.mjs ./scripts/
# prisma.config.ts requires DATABASE_URL even to generate the client (run by
# postinstall); nothing connects during the build, so a placeholder is enough.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm ci

# --- Build ---------------------------------------------------------------------
FROM deps AS builder
COPY . .
RUN npx next build

# --- Tools (migrations, seed, account) -----------------------------------------
FROM builder AS tools
ENV NODE_ENV=production
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

# --- App -----------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
