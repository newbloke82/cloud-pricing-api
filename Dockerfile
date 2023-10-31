FROM node:16.13-alpine3.12 as build

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --production \
  && cp -R node_modules prod_node_modules \
  && npm install
COPY . .
RUN npm run build

FROM node:16.13-alpine3.12 as release

RUN apk add --no-cache bash ca-certificates curl postgresql-client && rm -rf /var/cache/apk/*
RUN curl "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem" --output /tmp/global-bundle.pem
RUN cat /tmp/global-bundle.pem >> /etc/ssl/certs/ca-certificates.crt

WORKDIR /usr/src/app
RUN mkdir -p data/products

RUN addgroup -g 1001 -S infracost && \
  adduser -u 1001 -S infracost -G infracost && \
  chown -R infracost:infracost /usr/src/app
USER 1001

COPY --from=build /usr/src/app/prod_node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY package*.json ./
ENV NODE_ENV=production
EXPOSE 4000
CMD [ "npm", "run", "start" ]
