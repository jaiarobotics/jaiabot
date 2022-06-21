# build from just inside jaiabot
# docker build -t jaia-webtest -f src/web/docker/Dockerfile .

# run as
# docker run --network="host" -it jaia-webtest /opt/jaiabot/src/web/server/app.py 127.0.0.1

FROM ubuntu:focal

SHELL ["/bin/bash", "-c"]

ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /opt

# install the necessary components into the container
COPY src/web jaiabot/src/web
COPY src/lib/messages jaiabot/src/lib/messages

# install packages, build the server components, and remove unneeded packages
RUN apt update && apt install -y gpg && \
    echo "deb http://packages.gobysoft.org/ubuntu/release/ focal/" > /etc/apt/sources.list.d/gobysoft_release.list && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE && \
    apt update && apt install -y npm libgoby3-dev python3 python3-flask python3-protobuf && \
    cd /opt/jaiabot/src/web/central_command && ./build.sh && \
    cd /opt/jaiabot/src/web/server && ./build_messages.sh && \
    apt --purge autoremove -y npm libgoby3-dev gpg && \
    rm -rf /var/lib/apt/lists/*

# Expose the central command server port
EXPOSE 40001/tcp

CMD ["/opt/jaiabot/src/web/server/app.py", "127.0.0.1"]
