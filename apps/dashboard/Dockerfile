FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next/font downloads Inter and Inconsolata here, at build time, so viewers'
# browsers never contact Google.
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3200 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3200
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO /dev/null http://127.0.0.1:3200/login || exit 1
CMD ["node", "server.js"]
