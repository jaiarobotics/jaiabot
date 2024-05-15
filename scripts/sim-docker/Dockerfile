FROM ubuntu:focal
ENV jaia_log_dir=/var/log/jaiabot
ENV jaia_mode=simulation
ENV USER=root
ENV DEBIAN_FRONTEND=noninteractive
#note ENV above was not recommended for use becaue it affects the entire image and will make the contrainer work noninteractive
RUN apt update
RUN apt install -y sudo git gnupg lsb-release qt5-default python3-dev python3-testresources python3-pip python3-gdal python3-pyqt5 python3-fiona python3-geopandas gdal-bin libgdal-dev 
# The above line is what installed  python3-numexpr
RUN python3 -m pip install netifaces
RUN git clone https://github.com/jaiarobotics/jaiabot.git
WORKDIR /jaiabot/scripts
RUN git switch task/create-docker-environment-for-simulator
RUN /jaiabot/scripts/setup-tools-build-nodocker.sh
# Hack because line 4 of setup-tools-runtime.sh does not include "-y" and will fail to install these components when used in noninteractive environment
#RUN apt-get install -y goby3-apps goby3-gui goby3-moos parallel moos-ivp-apps moos-ivp-gui libmoos-ivp opencpn i2c-tools libgoby3-moos libgoby3-moos-dev libxcb-xinerama0 ntp screen
RUN /jaiabot/scripts/setup-tools-runtime.sh
WORKDIR /jaiabot
RUN /jaiabot/build.sh
COPY ./entrypoint.sh /entrypoint.sh
