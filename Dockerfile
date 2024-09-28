# Use an official Node.js runtime as a parent image
FROM node:20-slim

# Install necessary dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libnss3 \
    libxcomposite1 \
    libxrandr2 \
    libxdamage1 \
    libgbm1 \
    libgbm-dev \
    libx11-xcb1 \
    xdg-utils \
    libgtk-3-0 \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Skip downloading Chromium since we'll use the system Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_CACHE_DIR=/puppeteer/cache

# Verify Chrome installation
RUN ls -l /usr/bin/google-chrome-stable || echo "Chrome is missing"

# Create and check the cache directory
RUN mkdir -p /puppeteer/cache && ls -l /puppeteer/cache || echo "Cache directory creation failed"

# Set the working directory in the container
WORKDIR /app

# Copy the package.json and package-lock.json files to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code to the working directory
COPY . .

# Expose port 8080 to the outside world
EXPOSE 8080

# Command to run the app
CMD ["npm", "start"]