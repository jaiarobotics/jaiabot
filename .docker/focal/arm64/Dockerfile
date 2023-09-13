ARG distro=focal
FROM --platform=linux/amd64 ubuntu:$distro
ARG distro=focal

SHELL ["/bin/bash", "-c"]

ENV DEBIAN_FRONTEND=noninteractive

ENV CROSS_COMPILE_ARCHS "arm64 armhf"

RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get -y --no-install-recommends install \
            git build-essential ssh cmake gpg gpg-agent \
            devscripts equivs ca-certificates quilt \
            clang clang-tools dirmngr \
            dput cdbs \
            gcc-aarch64-linux-gnu \
            && rm -rf /var/lib/apt/lists/*

# Allow us to install packages for cross-compiling architectures
RUN ARCHS=(${CROSS_COMPILE_ARCHS}) && \
    ARCHS_LIST=$(IFS=,; echo "${ARCHS[*]}") && \
    for ARCH in "${ARCHS[@]}"; do dpkg --add-architecture "$ARCH"; done && \
    sed -i 's/deb /deb [arch=amd64] /' /etc/apt/sources.list && \
    egrep "^deb " /etc/apt/sources.list | sed "s/amd64/${ARCHS_LIST}/" \
        | sed 's|http://.*.ubuntu.com/ubuntu/|http://ports.ubuntu.com/|' \
        >> /etc/apt/sources.list

# Add packages.jaia.tech and signing key for packages.gobysoft.org and packages.jaia.tech
RUN echo -e "deb http://packages.jaia.tech/ubuntu/release/1.y/ ${distro}/\ndeb http://packages.jaia.tech/ubuntu/gobysoft/release/1.y/ ${distro}/" >> /etc/apt/sources.list.d/jaiabot_release_1.y.list && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com 954A004CD5D8CF32 && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE


# Install jaiabot dependencies
RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get -y install libdccl4:arm64 \
            libdccl4-dev:arm64 \
            libgoby3:arm64 \
            libgoby3-dev:arm64 \
            libgoby3-moos-dev:arm64 \
            libgoby3-moos:arm64 \
            libgoby3-gui-dev:arm64 \
            goby3-interfaces:amd64 \
            libnanopb-dev:arm64 \
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


# Allow compilation of this directory, even if it's owned by someone else, not root
RUN git config --global --add safe.directory /home/jaia/jaiabot

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
    && npm install -g npm@9.6.4 \
    && nvm install $NODE_VERSION \
    && nvm use --delete-prefix $NODE_VERSION \
    && npm i -g webpack webpack-cli

# NVM Post Install Setup
ENV NODE_PATH $NVM_DIR/versions/node/$NODE_VERSION/bin
ENV PATH $NODE_PATH:$PATH
