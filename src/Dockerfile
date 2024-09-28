# Use the official Node.js image with a specific version
FROM node:20

# Install necessary dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    libgconf-2-4 \
    libnss3 \
    libxss1 \
    libasound2 \
    fonts-liberation \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libxshmfence-dev \
    lsof \
    --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json first for better caching
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy the rest of your project files to the container
COPY . .

# Expose the port that your app will run on
EXPOSE 8080

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Start the application
CMD ["npm", "start"]