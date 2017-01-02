#!/bin/bash
NAME='camera_web_server'
docker stop ${NAME}
docker rm  -v ${NAME}
sudo docker run -d --name ${NAME}  -it -p 3000:3000 camera-svr
