FROM resin/rpi-raspbian:jessie-20160831  
FROM hypriot/rpi-node:slim

ARG DIR_CAMERA=/srv/camera

WORKDIR ${DIR_CAMERA}

# Install app dependencies
COPY package.json ${DIR_CAMERA}
RUN npm install .

COPY camera_svr.js ${DIR_CAMERA}
# Bundle app source
COPY . ${DIR_CAMERA}


ENV LL=debug
CMD [ "npm", "start"]
