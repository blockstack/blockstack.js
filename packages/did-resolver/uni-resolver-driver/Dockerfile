# Dockerfile for exampleorg/uni-resolver-driver-did-example

FROM node:14
MAINTAINER Jolocom Dev <dev@jolocom.com>

WORKDIR /usr/src/app
ADD package.json ./
RUN yarn install

ADD ./ ./
RUN yarn tsc -p tsconfig.json --noEmit false --outDir uni-resolver-driver/stacks-resolver/

EXPOSE 8080

CMD [ "node", "uni-resolver-driver/index.js" ]
