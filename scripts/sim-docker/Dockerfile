FROM ubuntu:focal
ENV jaia_log_dir=/var/log/jaiabot
ENV jaia_mode=simulation
ENV USER=root
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update
RUN apt-get install -y sudo git gnupg lsb-release apt-utils vim
#items below must be installed here because ENV is not passed through sudo in the scripts below
RUN DEBIAN_FRONTEND=noninteractive TZ=Etc/UTC apt-get -y install tzdata keyboard-configuration
#Note next line only needed until jaiabot-debian/pull/64 is released
RUN apt-get install python3-netifaces
RUN git clone https://github.com/jaiarobotics/jaiabot.git
WORKDIR /jaiabot/scripts
#branch is only needed while debugging
RUN git switch task/create-docker-environment-for-simulator
RUN /jaiabot/scripts/setup-tools-build-nodocker.sh
RUN /jaiabot/scripts/setup-tools-runtime.sh
WORKDIR /jaiabot
RUN /jaiabot/build.sh
COPY ./entrypoint.sh /entrypoint.sh
