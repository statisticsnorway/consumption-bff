FROM node:12-alpine as build-stage

WORKDIR /app

COPY package.json /app/
RUN npm install

COPY secure/ /app/secure/
COPY server.js /app/

ENV PORT 3005

CMD ["npm", "run", "start"]
