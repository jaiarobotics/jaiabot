ARG distro=noble
FROM ubuntu:${distro}

ARG distro=noble
ARG repo=release
ARG version=2.y

SHELL ["/bin/bash", "-c"]
ENV DEBIAN_FRONTEND=noninteractive

# 1. Core Build Tools
RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get -y --no-install-recommends install \
            git build-essential ssh cmake gpg gpg-agent \
            devscripts equivs ca-certificates quilt \
            clang clang-tools dirmngr \
            dput cdbs wget curl ca-certificates \
            && rm -rf /var/lib/apt/lists/*

# 2. Add Jaia Robotics repositories
RUN echo -e "deb http://packages.jaia.tech/ubuntu/${repo}/${version}/ ${distro}/\ndeb http://packages.jaia.tech/ubuntu/gobysoft/${repo}/${version}/ ${distro}/" >> /etc/apt/sources.list.d/jaiabot_${repo}_${version}.list && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com 954A004CD5D8CF32 && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE

# 3. ByteTrack-cpp (Vertical-Beach) — built from source
RUN apt-get update && apt-get -y install --no-install-recommends libeigen3-dev git && \
    rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/Vertical-Beach/ByteTrack-cpp.git /tmp/ByteTrack-cpp && \
    cmake -S /tmp/ByteTrack-cpp -B /tmp/ByteTrack-cpp/build && \
    make -C /tmp/ByteTrack-cpp/build -j$(nproc) && \
    cp /tmp/ByteTrack-cpp/build/libbytetrack.so /usr/local/lib/ && \
    cp -r /tmp/ByteTrack-cpp/include/ByteTrack /usr/local/include/ && \
    ldconfig && \
    rm -rf /tmp/ByteTrack-cpp

# 4. ONNX Runtime Manual Installation (Noble ARM64 Workaround)
# This installs it to /usr/local so your C++ compiler finds it automatically
RUN wget https://github.com/microsoft/onnxruntime/releases/download/v1.24.3/onnxruntime-linux-aarch64-1.24.3.tgz && \
    tar -xzf onnxruntime-linux-aarch64-1.24.3.tgz && \
    cp -r onnxruntime-linux-aarch64-1.24.3/include/* /usr/local/include/ && \
    cp -r onnxruntime-linux-aarch64-1.24.3/lib/* /usr/local/lib/ && \
    rm -rf onnxruntime-linux-aarch64-1.24.3* && \
    ldconfig

# 5. JaiaBot Dependencies
RUN apt-get update && \
    apt-get -y install --no-install-recommends \
            libdccl4 libdccl4-dev dccl4-compiler \
            libgoby3 libgoby3-dev libais-dev \
            libgoby3-moos-dev libgoby3-moos \
            libgoby3-gui-dev goby3-interfaces \
            libnanopb-dev nanopb \
            libopencv-core-dev libopencv-imgproc-dev \
            libopencv-dnn-dev libopencv-videoio-dev libopencv-imgcodecs-dev \
            python3-protobuf graphviz doxygen \
            && rm -rf /var/lib/apt/lists/*

# 6. Native ARM Tooling (Arduino & Node/NVM)
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=/usr/local/bin sh -s v1.0.4 && \
    arduino-cli config init && arduino-cli core update-index && arduino-cli core install arduino:avr

RUN mkdir -p /usr/local/nvm
ENV NVM_DIR=/usr/local/nvm
ENV NODE_VERSION=v22.14.0
RUN curl https://raw.githubusercontent.com/creationix/nvm/v0.40.2/install.sh | bash && \
    source $NVM_DIR/nvm.sh && \
    nvm install $NODE_VERSION && \
    nvm use $NODE_VERSION && \
    npm install -g npm@11.2.0 webpack webpack-cli

ENV NODE_PATH=$NVM_DIR/versions/node/$NODE_VERSION/bin
ENV PATH=$NODE_PATH:$PATH

RUN git config --global --add safe.directory /home/jaia/jaiabot