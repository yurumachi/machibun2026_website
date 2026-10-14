FROM node:22-bookworm-slim
COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /uvx /bin/
ENV UV_PYTHON_INSTALL_DIR=/opt/uv-python \
    pnpm_config_store_dir=/root/.local/share/pnpm/store
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate \
 && uv python install 3.13
WORKDIR /work
