FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig*.json tailwind.config.* postcss.config.* ./
COPY src ./src
COPY server ./server
COPY database/MARIADB_SCHEMA_REFERENCE_ONLY_NOT_CONNECTED.sql ./database/
COPY docs ./docs
ENV VITE_BACKEND_ENABLED=true
RUN npm run build && npm run server:build && npm prune --omit=dev

FROM python:3.12-slim-bookworm
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 libgomp1 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY server/requirements.txt /tmp/requirements.txt
# CPU wheels avoid shipping CUDA libraries to a CPU hosting service.
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && pip install --no-cache-dir -r /tmp/requirements.txt
RUN python -c "from docling.document_converter import DocumentConverter"
COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=build /app /app
ENV DOCLING_PYTHON=/usr/local/bin/python
ENV NODE_ENV=production
CMD ["node", "server/app.cjs"]
