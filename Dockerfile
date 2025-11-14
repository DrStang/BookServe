# Multi-stage build for BookServe

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Setup backend
FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy backend files
COPY server/ ./server/

# Copy built frontend
COPY --from=frontend-build /app/client/build ./client/build

# Create data directories
RUN mkdir -p data/books data/uploads

# Expose port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production

# Start server
CMD ["node", "server/index.js"]
