#!/bin/bash
NAME='camera_web_server'
docker stop ${NAME}
docker rm  -v ${NAME}
sudo docker run  -d --name ${NAME}  -e "LL=info" -v /mnt/usbdrive/pics:/pics -it -p 3000:3000 camera-svr
