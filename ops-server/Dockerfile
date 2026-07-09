FROM node:22-alpine

RUN apk add --no-cache docker-cli

WORKDIR /app
COPY package.json server.js ./

EXPOSE 4000
CMD ["node", "server.js"]
