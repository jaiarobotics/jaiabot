FROM gobysoft/goby3-ubuntu-build-base:20.04.1

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update || true
RUN apt-get -y install ca-certificates 

# Update apt-key for packages.gobysoft.org (out of date in goby3-ubuntu-build-arm64)
RUN apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE

# Add packages.jaia.tech
RUN apt-get update && apt-get -y install dirmngr && \
    echo "deb http://packages.jaia.tech/ubuntu/release/1.y/ focal/" >> /etc/apt/sources.list.d/jaiabot_release_1.y.list && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com 954A004CD5D8CF32

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
            && \
    rm -rf /var/lib/apt/lists/*

# arduino-cli install
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=/usr/local/bin sh && \
    arduino-cli config init && \
    arduino-cli core update-index && \
    arduino-cli core install arduino:avr

