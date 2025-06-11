# --- Stage 1: Build frontend with Vite ---
FROM oven/bun:1.1.0 AS frontend-builder

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Set working directory
WORKDIR /app/frontend

# Copy frontend package files and install dependencies
COPY frontend/package.json ./
RUN bun install

# Copy the rest of the frontend source
COPY frontend .

# Build the Vite app (output to /app/frontend/dist)
RUN bun run build

# --- Stage 2: Backend with Hono and static files ---
FROM oven/bun:1.1.0 AS backend

# Set working directory
WORKDIR /app

# Copy backend package files and install dependencies
COPY backend/package.json ./
RUN bun install

# Copy backend source code
COPY backend .

# Copy static files from frontend build
COPY --from=frontend-builder /app/frontend/dist ./static

# Expose the port your Hono app uses
EXPOSE 3000

# Start the Hono server
CMD ["bun", "run", "start"]
