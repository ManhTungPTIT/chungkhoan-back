# Dockerfile
FROM node:22.11.0-alpine

WORKDIR /app

# Cài dependency trước để tận dụng cache
COPY package*.json ./
RUN npm install --production

# Copy source code trừ những gì được ignore trong .dockerignore
COPY . .

# Container Port dự định mở
EXPOSE 8800

CMD ["npm", "start"]