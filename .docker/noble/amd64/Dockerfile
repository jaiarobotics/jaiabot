ARG distro=noble
FROM --platform=linux/amd64 ubuntu:${distro}
ARG distro=noble
ARG repo=release
ARG version=2.y

SHELL ["/bin/bash", "-c"]

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get -y --no-install-recommends install \
            git build-essential ssh cmake gpg gpg-agent \
            devscripts equivs ca-certificates quilt \
            clang clang-tools dirmngr\
            dput cdbs \
            && rm -rf /var/lib/apt/lists/*

# Add packages.jaia.tech and signing key for packages.gobysoft.org and packages.jaia.tech
RUN echo -e "deb http://packages.jaia.tech/ubuntu/${repo}/${version}/ ${distro}/\ndeb http://packages.jaia.tech/ubuntu/gobysoft/${repo}/${version}/ ${distro}/" >> /etc/apt/sources.list.d/jaiabot_${repo}_${version}.list && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com 954A004CD5D8CF32 && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE

# Install jaiabot dependencies
RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get -y install libdccl4:amd64 \
            libdccl4-dev:amd64 \
            dccl4-apps:amd64 \
            libgoby3:amd64 \
            libgoby3-dev:amd64 \
            libgoby3-moos-dev:amd64 \
            libgoby3-moos:amd64 \
            libgoby3-gui-dev:amd64 \
            goby3-interfaces:amd64 \
            libnanopb-dev:amd64 \
            nanopb:amd64 \
            python3-protobuf:amd64 \
            wget:amd64 \
            curl:amd64 \
            nodejs:amd64 \
            webpack:amd64 \
            npm:amd64 \
            graphviz:amd64 \
            doxygen:amd64 \
            && \
    rm -rf /var/lib/apt/lists/*

# arduino-cli install
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=/usr/local/bin sh && \
    arduino-cli config init && \
    arduino-cli core update-index && \
    arduino-cli core install arduino:avr

# NVM Pre Install Setup
RUN mkdir -p /usr/local/nvm
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION v18.12.1

# NVM Download
RUN curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash

# NVM Install
RUN source $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm use --delete-prefix $NODE_VERSION \
    && npm install -g npm@9.6.4 \
    && npm i -g webpack webpack-cli

# NVM Post Install Setup
ENV NODE_PATH $NVM_DIR/versions/node/$NODE_VERSION/bin
ENV PATH $NODE_PATH:$PATH

RUN git config --global --add safe.directory /home/jaia/jaiabot
