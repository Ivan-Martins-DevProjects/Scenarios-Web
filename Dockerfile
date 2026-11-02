FROM node:22-alpine AS builder

WORKDIR /app

COPY client/package*.json ./
RUN npm install

COPY client/ .
RUN npm run build -- --configuration production
