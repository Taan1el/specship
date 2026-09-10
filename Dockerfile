FROM node:24-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 4175
CMD ["npm", "run", "start:api"]
