#!/bin/bash

set -e

script_dir=$(dirname $0)

cd ${script_dir}/..
mkdir -p build/arm64

LAST_BUILD_DATE=$(date -r build/arm64 +%s)
ONE_WEEK_LATER=$(expr "$LAST_BUILD_DATE" + 604800)

NOW=$(date +%s)

if [ $NOW -ge $ONE_WEEK_LATER ];
    then
        echo "****It's been a while since we updated packages in the container, so let's rebuild the container now to update the packages."
        docker build --no-cache .docker/focal/arm64 -t gobysoft/jaiabot-ubuntu-arm64:20.04.1
    else
        echo "****Up to date - let's get straight to compiling, shall we?"
fi  

docker run -v `pwd`:/home/ubuntu/jaiabot -w /home/ubuntu/jaiabot -t gobysoft/jaiabot-ubuntu-arm64:20.04.1 bash -c "./scripts/arm64_build.sh"

if [ -z "$1" ]
    then
        echo "             -----------"
        echo "Not Deploying as you didn't specify any targets"
    else
        for var in "$@"
	    do
    		echo "rsync build and config directories"
		    rsync -aP --exclude={build/arm64/src,build/arm64/CMakeFiles,build/amd64,src/web/dist,src/web/node_modules} src build config scripts ubuntu@"$var":/home/ubuntu/jaiabot/
	    done
fi

