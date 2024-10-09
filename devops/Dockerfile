FROM node:20.18-alpine

WORKDIR /app

RUN npm install -g npm@10.9.0 && \
    npm install -g tsx@4.19.1


ENTRYPOINT ["npx", "tsx", "index_16.ts"]
