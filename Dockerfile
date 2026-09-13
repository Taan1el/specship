FROM node:24-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# The node:alpine base image ships a non-root "node" user; run as that
# instead of root.
USER node

EXPOSE 4175
CMD ["npm", "run", "start:api"]
