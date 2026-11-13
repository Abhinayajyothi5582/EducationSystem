# Use official Node.js LTS image (Node 22+ has native node:sqlite)
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package definition
COPY package.json ./

# Copy all application files
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
