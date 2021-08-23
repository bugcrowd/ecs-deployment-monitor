FROM node:16-alpine

COPY . /usr/app
WORKDIR /usr/app
RUN npm ci 
CMD [ "npm", "test" ]

