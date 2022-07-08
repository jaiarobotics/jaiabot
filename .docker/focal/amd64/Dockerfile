FROM gobysoft/goby3-ubuntu-build-base:20.04.1

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update || true
RUN apt-get -y install ca-certificates 

# Update apt-key (out of date in goby3-ubuntu-build-arm64)
RUN apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE

# Install jaiabot dependencies
RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get -y install libgoby3:amd64 \
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

