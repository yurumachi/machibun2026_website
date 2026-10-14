FROM node:22-bookworm-slim
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /work
