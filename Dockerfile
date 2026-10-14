FROM node:22-bookworm-slim
COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /uvx /bin/
ENV UV_PYTHON_INSTALL_DIR=/opt/uv-python
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate \
 && uv python install 3.13
WORKDIR /work
