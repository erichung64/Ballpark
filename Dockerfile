FROM oven/bun:1.4.5
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY tsconfig.json ./
COPY public ./public
COPY src ./src
ENV NODE_ENV=production
CMD ["bun", "run", "start"]
