FROM gobysoft/goby3-ubuntu-build-arm64:20.04.1

ENV DEBIAN_FRONTEND=noninteractive

# Update apt-key (out of date in goby3-ubuntu-build-arm64)
RUN apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE

# Add packages.jaia.tech
RUN apt-get update && apt-get -y install dirmngr && \
    echo "deb http://packages.jaia.tech/ubuntu/release/1.y/ focal/" >> /etc/apt/sources.list.d/jaiabot_release_1.y.list && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com 954A004CD5D8CF32

# Install jaiabot dependencies
RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get -y install libgoby3:arm64 \
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
            && \
    rm -rf /var/lib/apt/lists/*



# Allow compilation of this directory, even if it's owned by someone else, not root
RUN git config --global --add safe.directory /home/ubuntu/jaiabot

# arduino-cli install
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=/usr/local/bin sh && \
    arduino-cli config init && \
    arduino-cli core update-index && \
    arduino-cli core install arduino:avr

