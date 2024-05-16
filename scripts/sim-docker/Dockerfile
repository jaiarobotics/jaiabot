FROM ubuntu:focal
ENV jaia_log_dir=/var/log/jaiabot
ENV jaia_mode=simulation
ENV USER=root
ENV DEBIAN_FRONTEND=noninteractive
#note ENV above was not recommended for use becaue it affects the entire image and will make the contrainer work noninteractive
RUN apt update
RUN apt install -y sudo git gnupg lsb-release
#RUN apt install -y qt5-default 
#RUN apt install -y python3-dev 
#RUN apt install -y python3-testresources 
#RUN apt install -y python3-pip 
#RUN apt install -y python3-gdal
#RUN apt install -y python3-pyqt5
#RUN apt install -y python3-fiona
#RUN apt install -y python3-geopandas
# The above line is what installed  python3-numexpr
#RUN apt install -y gdal-bin
#RUN apt install -y libgdal-dev 
#RUN python3 -m pip install netifaces
RUN git clone https://github.com/jaiarobotics/jaiabot.git
WORKDIR /jaiabot/scripts
RUN git switch task/create-docker-environment-for-simulator--no-liaison
RUN /jaiabot/scripts/setup-tools-build-nodocker.sh
# Hack because line 4 of setup-tools-runtime.sh does not include "-y" and will fail to install these components when used in noninteractive environment
#RUN apt-get install -y goby3-apps goby3-gui goby3-moos parallel moos-ivp-apps moos-ivp-gui libmoos-ivp opencpn i2c-tools libgoby3-moos libgoby3-moos-dev libxcb-xinerama0 ntp screen
RUN /jaiabot/scripts/setup-tools-runtime.sh
WORKDIR /jaiabot
RUN /jaiabot/build.sh
COPY ./entrypoint.sh /entrypoint.sh
