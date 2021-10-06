#!/bin/bash

set -e

script_dir=`pwd`
build_dir=${script_dir}/../build

cd ${script_dir}/..
mkdir -p ${build_dir}

LAST_BUILD_DATE=$(date -r ${build_dir} +%s)
ONE_WEEK_LATER=$(expr "$LAST_BUILD_DATE" + 604800)

NOW=$(date +%s)

if [ $NOW -ge $ONE_WEEK_LATER ];
    then
        echo "****It's been a while since we updated packages in the container, so let's take care of that now."
        #docker run -v `pwd`:/home/ubuntu/jaiabot -w /home/ubuntu/jaiabot -t gobysoft/jaiabot-ubuntu-arm64:20.04.1 bash -c "apt update && apt upgrade -y && ./scripts/arm64_build.sh"
    else
        echo "****Up to date - let's get straight to compiling, shall we?"
        docker run -v `pwd`:/home/ubuntu/jaiabot -w /home/ubuntu/jaiabot -t gobysoft/jaiabot-ubuntu-arm64:20.04.1 bash -c "./scripts/arm64_build.sh"
fi  

if [ -z "$1" ]
    then
        echo "             -----------"
        echo "Not Deploying as you didn't specify any targets"
    else
        for var in "$@"
	    do
    		echo "rsync build/bin and build/lib"
                echo ${build_dir}
		rsync --delete -aP ${build_dir}/bin ${build_dir}/lib ${build_dir}/include ubuntu@"$var":/home/ubuntu/jaiabot/build
    		echo "rsync python  and arduino scripts"
    		rsync --delete -aP src/python src/arduino ubuntu@"$var":/home/ubuntu/jaiabot/src
    		echo "rsync ../jaiabot-configuration"
		rsync --delete -aP ../jaiabot-configuration ubuntu@$1:/home/ubuntu/
	    done
fi

