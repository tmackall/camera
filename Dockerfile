FROM resin/rpi-raspbian:jessie-20160831  
FROM hypriot/rpi-node:slim

ARG DIR=/srv/camera

WORKDIR ${DIR}

# Install app dependencies
COPY package.json ${DIR}
RUN npm install .

COPY camera_svr.js ${DIR}
# Bundle app source
COPY . ${DIR}


ENV LL=info
CMD [ "npm", "start"]
