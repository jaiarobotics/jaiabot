FROM --platform=linux/amd64 ubuntu:focal

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
RUN echo -e "deb http://packages.jaia.tech/ubuntu/release/1.y/ focal/\ndeb http://packages.jaia.tech/ubuntu/gobysoft/1.y/ focal/" >> /etc/apt/sources.list.d/jaiabot_release_1.y.list && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com 954A004CD5D8CF32 && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE

# Install jaiabot dependencies
RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get -y install libdccl4:amd64 \
            libdccl4-dev:amd64 \
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

# NVM install
RUN curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash \
    && export NVM_DIR="$HOME/.nvm" \
    && . $NVM_DIR/nvm.sh \
    && nvm install v18.12.1 \
    && nvm use v18.12.1 \
    && npm install i -g --no-audit webpack webpack-cli
