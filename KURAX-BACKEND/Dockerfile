FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

RUN apk add --no-cache postgresql-client

COPY . .

RUN mkdir -p uploads

ENV NODE_ENV=production

EXPOSE 5010

CMD ["node", "server.js"]
