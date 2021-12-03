#!/bin/bash

rsync -a --delete --exclude dist --exclude node_modules --exclude package-lock.json ./ optiplex:jaia_web/

#ssh -t optiplex 'cd jaia_web; ./build.sh; node dist/server/server.js'
#ssh -t optiplex 'cd jaia_web; ./build.sh; ./https_server.py'
ssh -t optiplex 'cd jaia_web; ./build.sh; cd flask-server; ./app.py'
