FROM node:10-alpine

COPY . /usr/app
WORKDIR /usr/app
RUN npm install
CMD [ "npm", "test" ]
