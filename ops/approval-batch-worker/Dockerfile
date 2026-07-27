# Build the standalone TypeScript worker without the Next.js runtime.
FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
COPY tsconfig.json tsconfig.worker.json ./
COPY src/workers ./src/workers
RUN npm run build:worker

FROM node:20-alpine AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 10002 approvalworker \
    && adduser --system --uid 10002 --ingroup approvalworker approvalworker

COPY --from=production-dependencies --chown=approvalworker:approvalworker \
  /app/node_modules ./node_modules
COPY --from=builder --chown=approvalworker:approvalworker \
  /app/dist-worker ./dist-worker
COPY --chown=approvalworker:approvalworker package.json ./

USER 10002:10002
EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http=require('node:http');const request=http.get({host:'127.0.0.1',port:process.env.APPROVAL_BATCH_WORKER_HEALTH_PORT||8081,path:'/ready',timeout:4000},response=>{response.resume();process.exit(response.statusCode===200?0:1)});const fail=()=>process.exit(1);request.on('error',fail);request.on('timeout',()=>{request.destroy();fail()})"

CMD ["npm", "run", "start:worker"]
