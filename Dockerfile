FROM node:20-slim

WORKDIR /app

# Install production dependencies from the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Application modules (split by responsibility; see src/).
COPY server.js ./
COPY src ./src

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

USER node
CMD ["node", "server.js"]
