FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS base
# Prisma's Linux engine requires libssl3. Versions verified in signed Debian repositories.
RUN apt-get update && apt-get install -y --no-install-recommends openssl=3.0.22-1~deb12u1 libssl3=3.0.22-1~deb12u1 ca-certificates=20250419~deb12u1 && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM dependencies AS build
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_WHATSAPP_NUMBER
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_WHATSAPP_NUMBER=$NEXT_PUBLIC_WHATSAPP_NUMBER NEXT_TELEMETRY_DISABLED=1
RUN node -e "const u=new URL(process.env.NEXT_PUBLIC_SITE_URL);if(u.protocol!=='https:'||u.origin!==process.env.NEXT_PUBLIC_SITE_URL||!/^[0-9]{8,15}$/.test(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER||''))throw Error('Valid public HTTPS origin and support number required')" && npm run build
RUN node -e "const fs=require('node:fs');const ts=require('typescript');fs.writeFileSync('next.config.mjs',ts.transpileModule(fs.readFileSync('next.config.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText)"

# One-off operator tooling; no mutation runs during the image build or startup.
FROM dependencies AS release
ENV NODE_ENV=production
COPY --chown=node:node scripts/create-admin.ts ./scripts/create-admin.ts
RUN node -e "const fs=require('node:fs');const ts=require('typescript');fs.writeFileSync('scripts/create-admin.mjs',ts.transpileModule(fs.readFileSync('scripts/create-admin.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText)" && npm prune --omit=dev
USER node
CMD ["node", "--version"]

FROM build AS production-dependencies
RUN npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/next.config.mjs ./next.config.mjs
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
