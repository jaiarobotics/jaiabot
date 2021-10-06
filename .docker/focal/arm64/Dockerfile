FROM gobysoft/goby3-ubuntu-build-arm64:20.04.1

ENV DEBIAN_FRONTEND=noninteractive

# Update apt-key (out of date in goby3-ubuntu-build-arm64)
RUN apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE

# Install jaiabot dependencies
RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get -y install libgoby3-dev:arm64 \
            libgoby3-moos-dev:arm64 \
            libgoby3-moos:arm64 \
            libgoby3-gui-dev:arm64 \
            goby3-interfaces:amd64 \
            libnanopb-dev:arm64 \
            nanopb:amd64 \
            python3-protobuf:amd64 \
            && \
    rm -rf /var/lib/apt/lists/*
