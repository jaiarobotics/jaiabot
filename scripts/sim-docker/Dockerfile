# This static Dockerfile was created to avoid having to install cmake on the Mac
# We should switch to using the Dockerfile.in to avoid hard coded versions etc
FROM ubuntu:noble
ENV jaia_log_dir=/var/log/jaiabot
ENV jaia_mode=simulation
ENV USER=jaia
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update
RUN apt-get install -y sudo git gnupg lsb-release apt-utils vim
#items below must be installed here because ENV is not passed through sudo in the scripts below
# Install packages to allow apt to use a repository over HTTPS:
RUN sudo apt-get -y install apt-transport-https ca-certificates curl gnupg lsb-release
# Add packages.gobysoft.org mirror to your apt sources
RUN default_version=${jaia_version_release_branch}

RUN echo "deb http://packages.jaia.tech/ubuntu/gobysoft/continuous/2.y `lsb_release -c -s`/" | sudo tee /etc/apt/sources.list.d/gobysoft_continuous.list
# Install the public key for packages.gobysoft.org
RUN sudo apt-key adv --recv-key --keyserver hkp://keyserver.ubuntu.com:80 19478082E2F8D3FE

RUN echo "deb http://packages.jaia.tech/ubuntu/continuous/2.y `lsb_release -c -s`/" | sudo tee /etc/apt/sources.list.d/jaiabot_continuous.list
# Install the public key for packages.jaiabot.org
RUN sudo apt-key adv --recv-key --keyserver hkp://keyserver.ubuntu.com:80 954A004CD5D8CF32

# Update apt
RUN sudo apt-get -y update
# Install the required packages   
RUN sudo apt-get install -y goby3-gui goby3-apps goby3-moos jaiabot-apps jaiabot-python jaiabot-config jaiabot-web moos-ivp-apps moosdb10 libmoos-ivp gpsd wireguard ntp ntpstat python3-systemd ansible
# we may need this if line 4 is not enough
#RUN useradd -mUs /bin/bash jaia




