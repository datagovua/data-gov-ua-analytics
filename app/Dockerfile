FROM node:7.4-alpine
ADD . /src
WORKDIR /src
RUN cd /src && npm install -g yarn && yarn install
CMD ["node", "app.js", "--cron", "0 10 0 * * 6", "--run"]
