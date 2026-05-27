FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# MCP server reads from the DB file path passed via DATABASE_URL env var
ENV DATABASE_URL=file:/data/bws.db

CMD ["node", "dist/index.js"]
