# Creating an ARM64 image form deb package to run JAIA Simulation on a Mac

## Dockerfile

Updated Dockerfile.in to install everything from pre-built packages instead of building from source.  

Used `2.y` versions of all packages to avoid issues with `pip install` items

#### Dockerfile.in

```
FROM ubuntu:@JAIA_VERSION_UBUNTU_CODENAME@
ENV jaia_log_dir=/var/log/jaiabot
ENV jaia_mode=simulation
ENV USER=root
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update
RUN apt-get install -y git gnupg lsb-release apt-utils vim screen
# Install packages to allow apt to use a repository over HTTPS:
RUN apt-get -y install apt-transport-https ca-certificates curl gnupg lsb-release
RUN default_version=${jaia_version_release_branch}
# Add packages.gobysoft.org mirror to your apt sources
RUN echo "deb http://packages.jaia.tech/ubuntu/gobysoft/continuous/2.y `lsb_release -c -s`/" | tee /etc/apt/sources.list.d/gobysoft_continuous.list
# Install the public key for packages.gobysoft.org
RUN apt-key adv --recv-key --keyserver hkp://keyserver.ubuntu.com:80 19478082E2F8D3FE
# Add jaia packages to your apt sources
RUN echo "deb http://packages.jaia.tech/ubuntu/continuous/2.y `lsb_release -c -s`/" | tee /etc/apt/sources.list.d/jaiabot_continuous.list
# Install the public key for packages.jaiabot.org
RUN apt-key adv --recv-key --keyserver hkp://keyserver.ubuntu.com:80 954A004CD5D8CF32

# Update apt
RUN apt-get -y update
# Install the required packages   
RUN apt-get install -y goby3-gui goby3-apps goby3-moos jaiabot-apps jaiabot-python jaiabot-config jaiabot-web moos-ivp-apps moosdb10 libmoos-ivp gpsd wireguard ntp ntpstat python3-systemd ansible
# we may need this if line 4 is not enough
RUN useradd -mUs /bin/bash jaia
#COPY ./entrypoint.sh /entrypoint.sh
```

## Creating Initial Image

Build on ARM machine, running on AMD machine is VERY slow.

`docker build  --no-cache -t jaiauser:jaia-sim-image .`

## Testing Initial Image

Launched the image in a container without using any entrypoint 

`docker run --rm --name jaia-sim-container -d -i -t -p "40001:40001" -p "9092:9092" jaiauser:jaia-sim-image /bin/bash`

Logged into runnig container to manually launch the simulation and JCC

`docker exec -it jaia-sim-container bash`

## Debugging Image

### Getting the Simulation Running

Launch from `/usr/share/jaiabot/config/launch/simulation`

The libraries installed by the deb packages had version numbers on them, which caused problems with the launch scripts.  `bot.launch` and `hub.launch` were edited to look for the correct version of the libraries.


replaced `goby_liaison_jaiabot`with`[env=GOBY_LIAISON_PLUGINS=libjaiabot_liaison.so.1] goby_liaison` which should work for both local machines and installed versions. Note: we can get rid of that unused shell script (`goby_liaison_jaiabot`)

#### bot.launch

```
#!/usr/bin/env -S goby_launch -L -P -d 100

# start this first so it's done before we get to the MOOS parts
[kill=SIGTERM] ../../gen/moos_gen.sh

[kill=SIGTERM] gpsd $(../../gen/bot.py gpsd)

# start the Goby processes
gobyd <(../../gen/bot.py gobyd)
[env=GOBY_MODEMDRIVER_PLUGINS=libjaiabot_xbee.so.1:libjaiabot_wifi.so.1] goby_intervehicle_portal <(../../gen/bot.py goby_intervehicle_portal)  -vvv -n
[env=GOBY_MOOS_GATEWAY_PLUGINS=libgoby_ivp_frontseat_moos_gateway_plugin.so.30:libjaiabot_moos_gateway_plugin.so.1] goby_moos_gateway <(../../gen/bot.py goby_moos_gateway)
[env=GOBY_LIAISON_PLUGINS=libjaiabot_liaison.so.1] goby_liaison <(../../gen/bot.py goby_liaison)
jaiabot_simulator <(../../gen/bot.py jaiabot_simulator)
jaiabot_fusion <(../../gen/bot.py jaiabot_fusion)
jaiabot_mission_manager <(../../gen/bot.py jaiabot_mission_manager) -vvv -n
goby_gps <(../../gen/bot.py goby_gps)
goby_logger <(../../gen/bot.py goby_logger)
jaiabot_metadata <(../../gen/bot.py jaiabot_metadata)

# vehicle MOOS components
[kill=SIGTERM] MOOSDB /tmp/jaiabot_${jaia_bot_index}.moos
[kill=SIGTERM] pHelmIvP /tmp/jaiabot_${jaia_bot_index}.moos
# [kill=SIGTERM] pMarineViewer /tmp/jaiabot_pmv_${jaia_bot_index}.moos
[kill=SIGTERM] uProcessWatch /tmp/jaiabot_${jaia_bot_index}.moos
[kill=SIGTERM] pNodeReporter /tmp/jaiabot_${jaia_bot_index}.moos

# simulator MOOS components
[kill=SIGTERM] MOOSDB /tmp/jaiabot_sim_${jaia_bot_index}.moos
[kill=SIGTERM] uSimMarine /tmp/jaiabot_sim_${jaia_bot_index}.moos
# [kill=SIGTERM] pMarinePID /tmp/jaiabot_sim_${jaia_bot_index}.moos

jaiabot_pid_control <(../../gen/bot.py jaiabot_pid_control)
jaiabot_engineering <(../../gen/bot.py jaiabot_engineering) -vvvv

goby_coroner <(../../gen/bot.py goby_coroner) --expected_name goby_liaison --expected_name jaiabot_simulator --expected_name jaiabot_fusion --expected_name jaiabot_bluerobotics_pressure_sensor_driver --expected_name jaiabot_mission_manager --expected_name goby_gps --expected_name goby_logger --expected_name jaiabot_metadata --expected jaiabot_pid_control --expected_name jaiabot_health --expected_name jaiabot_adafruit_BNO055_driver --expected_name jaiabot_atlas_scientific_ezo_ec_driver
jaiabot_health <(../../gen/bot.py jaiabot_health)

# Need to confirm the below lines included from engineering launch, but commented to match standard

# Pressure sensor
jaiabot_bluerobotics_pressure_sensor_driver <(../../gen/bot.py jaiabot_bluerobotics_pressure_sensor_driver)

# IMU sensor
jaiabot_adafruit_BNO055_driver <(../../gen/bot.py jaiabot_adafruit_BNO055_driver)

# Salinity sensor
jaiabot_atlas_scientific_ezo_ec_driver <(../../gen/bot.py jaiabot_atlas_scientific_ezo_ec_driver) -vv

```

#### hub.launch

```
#!/usr/bin/env -S goby_launch -P -L

[kill=SIGTERM] gpsd $(../../gen/hub.py gpsd)

gobyd <(../../gen/hub.py gobyd) -vvv -n
[env=GOBY_MODEMDRIVER_PLUGINS=libjaiabot_xbee.so.1:libjaiabot_wifi.so.1] goby_intervehicle_portal <(../../gen/hub.py goby_intervehicle_portal) -vvv -n
[env=GOBY_LIAISON_PLUGINS=libjaiabot_liaison.so.1] goby_liaison <(../../gen/hub.py goby_liaison)
jaiabot_simulator <(../../gen/hub.py jaiabot_simulator)
goby_gps <(../../gen/hub.py goby_gps)
goby_logger <(../../gen/hub.py goby_logger)

jaiabot_hub_manager <(../../gen/hub.py jaiabot_hub_manager) -vvv
jaiabot_web_portal <(../../gen/hub.py jaiabot_web_portal) -v
jaiabot_metadata <(../../gen/hub.py jaiabot_metadata)

# Uncomment the following 2 lines to use opencpn
# goby_opencpn_interface <(../../gen/hub.py goby_opencpn_interface)
# [kill=SIGTERM] socat tcp:localhost:30100 pty,link=/tmp/pty_jaiahub,raw,echo=0

goby_coroner <(../../gen/hub.py goby_coroner) --expected_name goby_liaison --expected_name jaiabot_hub_manager --expected_name jaiabot_web_portal --expected_name jaiabot_metadata --expected_name jaiabot_health
jaiabot_health <(../../gen/hub.py jaiabot_health)

#[kill=SIGTERM] ../../../build/amd64/share/jaiabot/web/server/app.py

```

### Getting JCC Running

Initial attempts to run JCC ran into issues becuase there was no user named jaia.

`useradd -ms /bin/bash jaia` was done to get through the initial errors.  At this time we are not sure if this was needed because we ended up launching it differently.  Also the initial image was built with `ENV USER=root` in the Dockerfile.  Will retest with `ENV USER=jaia`

Launched JCC from `/usr/share/jaiabot/web/server/` by first activating `venv`

```
root@9a7f65d7bbef:/usr/share/jaiabot/web/server# source /usr/share/jaiabot/python/venv/bin/activate
(venv) root@9a7f65d7bbef:/usr/share/jaiabot/web/server# ./app.py localhost

```


### TODO

* Replace static Dockerfile with Dockerfile.in
  * DONE
* Test new Dockerfile.in builing of images for both AMD and ARM architectures
  * Tested on Ubuntu, passed after editing 2 launch scripts
  * install cmake on Mac and run the same way as on Ubuntu
* Find a way to get around the library versioning so we do not need to edit the launch scripts.
* Create entry file to launch the sim and JCC
* Update circleci to build both AMD and ARM docker images and push to the hub
