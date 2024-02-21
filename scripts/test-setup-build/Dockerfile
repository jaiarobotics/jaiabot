FROM --platform=linux/amd64 ubuntu:focal

SHELL ["/bin/bash", "-c"]

ENV DEBIAN_FRONTEND=noninteractive

# install tzdata so it doesn't ask the timezone when running
RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get -y --no-install-recommends install \
            git build-essential ssh cmake gpg gpg-agent \
            devscripts equivs ca-certificates quilt \
            clang clang-tools dirmngr\
            dput cdbs \
            && rm -rf /var/lib/apt/lists/*

RUN git config --global --add safe.directory /home/jaia/jaiabot
