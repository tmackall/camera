#!/bin/bash

NAME="camera-svr"
VERSION="latest"
IMAGE="tmackall/${NAME}:${VERSION}"
docker build -t "$IMAGE" .
docker push "$IMAGE"
