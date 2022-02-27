#!/bin/bash

SERVER=$1

rsync -a --delete --exclude dist --exclude node_modules --exclude package-lock.json ./ ${SERVER}:jaia_web/
ssh -t optiplex 'cd jaia_web; ./build.sh; cd server; ./app.py'
