#!/usr/bin/env bash


##
## Usage:
## jaiabot_systemd_type=bot ./docker-arm64-build-and-deploy.sh 172.20.11.102
##
## Command line arguments is a list of Jaiabots to push deployed code to.
## If omitted, the code is just built, but not pushed
## Env var "jaiabot_systemd_type" can be set to one of: bot, hub, which will generate and enable the appropriate systemd services. If unset, the systemd services will not be installed and enabled
## Env var "jaiabot_debconf_selections" can be set to a debconf-set-selections format file to configure the target from that file instead of from the target's own debconf database
## Env var "jaiabot_machine_type" can be set to one of: virtualbox, which will build amd64 binaries instead. If unset, the target will be the standard arm64 embedded system.
## Env var "jaiabot_repo" can be set to one of: release, continuous, beta, test, which will set the repository to use for install 'apt' dependencies in the Docker container. If unset, "release" will be used.
## Env var "jaiabot_version" can be set to one of: 1.y, 2.y, etc. which will set the version of the 'apt' repository. If unset, the value of "$jaia_version_release_branch" will be used (the default for this current branch).
## Env var "jaiabot_distro" can be set to one of: focal, jammy which will set the Ubuntu distribution to use. If unset, the value of "$jaia_version_ubuntu_codename" will be used.

set -e

botuser=jaia

function dockerPackageVersion() {
    docker run --env JAIA_BUILD_NPROC -v `pwd`:/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot -t ${image_name} apt show $1 | sed -n 's/^Version: \(.*\)~.*$/\1/p'
}

script_dir=$(dirname $0)

set -a; source ${script_dir}/common-versions.env; set +a 

repo=${jaiabot_repo:-release}

default_version=${jaia_version_release_branch}
version=${jaiabot_version:-${default_version}}
version_lower=$(echo "$version" | tr '[:upper:]' '[:lower:]')
distro=${jaiabot_distro:-${jaia_version_ubuntu_codename}}

if [[ "$jaiabot_machine_type" == "virtualbox" ]]; then
    cd ${script_dir}/..

    build_dir=build/${distro}-${version_lower}-amd64-vbox   
    mkdir -p ${build_dir}

    image_name=jaia_build_vbox_${distro}_${repo}_${version_lower}

    if [ "$(docker image ls ${image_name} --format='true')" != "true" ];
    then
        echo "🟢 Building the docker ${image_name} image"
        ./scripts/docker-build-build-system.sh
    fi

    echo "🟢 Building jaiabot apps using docker ${image_name} image to ${build_dir}"
    docker run --env JAIA_BUILD_NPROC -v `pwd`:/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot -t ${image_name} bash -c "./scripts/amd64-build-vbox.sh ${build_dir}"

else    
    cd ${script_dir}/..

    build_dir=build/${distro}-${version_lower}-arm64
    mkdir -p ${build_dir}
    image_name=jaia_build_${distro}_${repo}_${version_lower}


    if [ "$(docker image ls ${image_name} --format='true')" != "true" ];
    then
        echo "🟢 Building the docker ${image_name} image"
        ./scripts/docker-build-build-system.sh
    fi

    echo "🟢 Building jaiabot apps using docker ${image_name} image to ${build_dir}"
    docker run --env JAIA_BUILD_NPROC -v `pwd`:/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot -t ${image_name} bash -c "./scripts/arm64-build.sh ${build_dir}"
fi

# Get goby and dccl versions currently installed into the build image
docker_libgoby_version=$(dockerPackageVersion libgoby3)
docker_libdccl_version=$(dockerPackageVersion libdccl4)

# Remove old library files
echo "🟢 Cleaning old library files"
docker run --env JAIA_BUILD_NPROC -v `pwd`:/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot/scripts -t ${image_name} bash -c "./clean-lib-directory.py"

if [ -z "$1" ]
then
    echo "             -----------"
    echo "Not Deploying as you didn't specify any targets"
else
    for remote in "$@"
    do
        echo "🟢 Uploading to "$remote

        # systemd.py on the target reads its configuration from this file rather
        # than from the command line. It is generated per target, inside this
        # loop, because each bot has its own bot_id - one file made before the
        # loop would give every bot in the deploy the same identity.
        selections=${build_dir}/jaiabot-embedded.selections

        if [ ! -z "${jaiabot_debconf_selections}" ]; then
            echo "🟢 Using debconf selections from ${jaiabot_debconf_selections}"
            cp "${jaiabot_debconf_selections}" "${selections}"
        else
            echo "🟢 Reading debconf selections from "$remote
            # debconf-get-selections prefixes rows with 'unknown' when the owning
            # package isn't registered; rewrite it as jaia-create-fleet-config.sh does
            ssh ${botuser}@"${remote}" "sudo debconf-get-selections | grep 'jaiabot-embedded/'" \
                | sed 's/^unknown/jaiabot-embedded/' > "${selections}"

            if [ ! -s "${selections}" ]; then
                echo "❌ No jaiabot-embedded debconf answers found on ${remote}."
                echo "   Install jaiabot-embedded there first, or set jaiabot_debconf_selections=<file>."
                exit 1
            fi
        fi

        # The deploy switch is authoritative over whatever the target believes it
        # is, so that hub services are never generated on top of bot config.
        if [ ! -z "${jaiabot_systemd_type}" ]; then
            sed -i "/^jaiabot-embedded[[:space:]]\+jaiabot-embedded\/type[[:space:]]/d" "${selections}"
            printf 'jaiabot-embedded\tjaiabot-embedded/type\tselect\t%s\n' "${jaiabot_systemd_type}" >> "${selections}"
        fi

        # Sync all directories
        rsync -za --force --relative --delete --exclude node_modules/ --exclude venv/ ./${build_dir}/bin ./${build_dir}/include ./${build_dir}/share/ ./${build_dir}/lib ./${selections} ./config ./scripts ${botuser}@"$remote":/home/${botuser}/jaiabot/

        # Login to the target, and deploy the software
        ssh ${botuser}@"${remote}" "jaiabot_systemd_type=${jaiabot_systemd_type} jaiabot_machine_type=${jaiabot_machine_type} docker_libgoby_version=${docker_libgoby_version} docker_libdccl_version=${docker_libdccl_version} bash -c \"./jaiabot/scripts/arm64-deploy.sh ${build_dir}\""

        if [ ! -z $jaiabot_systemd_type ]; then
            echo "When you're ready, ssh ${botuser}@${hostname} and run 'sudo systemctl start jaiabot'"
        fi

    done
fi

