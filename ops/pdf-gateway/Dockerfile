# Validate source syntax before copying only runtime files into the final image.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS verifier
WORKDIR /app
COPY *.mjs ./
RUN find . -maxdepth 1 -name '*.mjs' -exec node --check {} \;

FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080

RUN addgroup --system --gid 10001 pdfgateway \
    && adduser --system --uid 10001 --ingroup pdfgateway pdfgateway

COPY --from=verifier --chown=pdfgateway:pdfgateway /app ./

USER 10001:10001
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const net=require('node:net');const socket=net.connect(process.env.PORT||8080,'127.0.0.1');const fail=()=>process.exit(1);socket.setTimeout(5000);socket.on('connect',()=>{socket.end();process.exit(0)});socket.on('timeout',fail);socket.on('error',fail)"

CMD ["node", "server.mjs"]
