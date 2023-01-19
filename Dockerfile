FROM ctapang/node-17-python3

WORKDIR /app
COPY . /app

RUN yarn install

WORKDIR /app/packages/server

RUN yarn build

CMD ["yarn", "start"]

EXPOSE 3000
