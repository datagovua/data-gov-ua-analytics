FROM node:7.10-alpine
RUN apk add --update python build-base tini
ENTRYPOINT ["/sbin/tini", "-g", "--"]
