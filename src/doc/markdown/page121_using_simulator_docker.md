# Using the Jaiabot Simulator in a Docker

- [Using the Jaiabot Simulator in a Docker](#using-the-jaiabot-simulator-in-a-docker)
  - [Install Docker](#install-docker)
  - [Download pre-built Docker images (preferred)](#download-pre-built-docker-images-preferred)
  - [Run the Simulator](#run-the-simulator)
    - [Using docker compose](#using-docker-compose)
      - [Start the simulator](#start-the-simulator)
      - [Stop the simulator](#stop-the-simulator)
    - [Using docker run](#using-docker-run)
      - [Start the simulator](#start-the-simulator-1)
      - [Stop the simulator](#stop-the-simulator-1)
  - [Using JCC](#using-jcc)
  - [Using JDV](#using-jdv)
  - [Working with images locally (advanced, Linux platforms only)](#working-with-images-locally-advanced-linux-platforms-only)

## Install Docker

The user must install Docker on their host machine. See https://www.docker.com/get-started/

The user must use a terminal/command prompt environment to run the Jaiabot Docker Simulation.  Desktop versions of docker do not support all of the options used.  However, depending on how docker was installed you may need to launch the desktop app to start the docker engine.

A few important Docker terms:

- _image_ - refers to a self contained run enviroment
- _container_ - refers to a running instance of an image

## Download pre-built Docker images (preferred)

As of 2.y release the Jaiabot Docker Simulation images are generated for both AMD64 and ARM64 host machines and pushed to the Gobysoft Dockerhub with each release of Jaiabot software.

- Choose the `<tag>` of the version you want (e.g. `2.1.0` or `2.y-beta`, `2.y-continuous`, `2.y-test` )for the latest of the respective repository.
- Pull the image
  - use gobysoft/jaiabot-sim:<tag>
    - e.g. `docker pull gobysoft/jaiabot-sim:2.0.0`
  - Available images can be found at
    - https://hub.docker.com/r/gobysoft/jaiabot-sim/tags
- Check image
  - `docker images` will list all available images on your machine.  You should see one that looks like
    ```
    REPOSITORY                   TAG                    IMAGE ID       CREATED        SIZE
    gobysoft/jaiabot-sim         2.0.0                  751dc04f83a9   21 hours ago   2.68GB
    ```

## Run the Simulator

### Using docker compose
Docker compose provides a platform independent way to configure and run docker conatainers.  The easiest way to launch the JAIA Simulator in docker is to use a `docker-compose.yml` file.  The user can download a pre-defined file from `scripts/sim-docker/docker-compose.yml` at https://github.com/jaiarobotics/jaiabot

Example:
```
# Docker Compose file for launching the JAIA Simulator
# To launch the simulator 
# docker compose up -d jaia-sim
# To stop the simulator
# docker compose down

services:

  jaia-sim:
    image: gobysoft/jaiabot-sim:2.0.0
    container_name: jaia-sim-container

    # Simulation Environment
    environment:
      JAIA_SIM_BOTS: 5
      JAIA_SIM_WARP: 3
      JAIA_SIM_FLEET: 30

    # Expose necessary ports for simulation communication
    # All ports will be available at localhost
    ports:
      - "40001:40001"      # JCC 
      - "9092:9092"        # REST API
      - "40011:40011"      # JDV

    volumes:
      # shared folder mapping for JDV, replace "./jdv_data" with other directory as needed
      - ./jdv_data:/var/log/jaiabot/bot_offload

    stdin_open: true
    tty: true
    restart: "no"
```
#### Start the simulator

From the same directory as the `docker-compose.yml` file the following command will launch the simulator, including JCC, JDV, and the Jaia REST API.

`docker compose up -d jaia-sim`

#### Stop the simulator

From the same directory as the `docker-compose.yml` file the following command will shut down the simulator, stop the container and remove it.

`docker compose down`

### Using docker run

If the user does not want to use docker compose the simulation can also be run using the `docker run` command.

#### Start the simulator

`docker run --rm --name jaia-sim-container -d -i -t -p 40001:40001 -p 9092:9092 -p 40011:40011 --env JAIA_SIM_BOTS=5 --env JAIA_SIM_WARP=3 --env JAIA_SIM_FLEET=30 -v ./jdv_data:/var/log/jaiabot/bot_offload gobysoft/jaiabot-sim:2.0.0 /bin/bash`

Explanation of command.

```
  "docker run" Command to run the image in a new container 
  "--rm" Tells docker to remove the container after it is stopped
  "--name jaia-sim-container" Names the container "jaia-sim-container"
  "-d -i -t" Tells docker to run in a detached mode and to include an interactive terminal. This allows the user to log into the running container if needed (advanced)
  "-p 40001:40001" Exposes the port used by JCC to the host machine
  "-p 9092:9092 " Exposes the port used by used for the REST APIto the host machine
      - Example: Rest API -> http://localhost:9092/jaia/v1/status/all?api_key=simulation
  "-p 40011:40011" Exposes the port used by JDV to the host machine
  "-env JAIA_SIM_BOTS=5" Number of bots used in sim
  "--env JAIA_SIM_WARP=3" Warp factor used in sim
  "--env JAIA_SIM_FLEET=30" Fleet number used in sim
  "-v ./jdv_data:/var/log/jaiabot/bot_offload" Mounts the bot_offload folder in the container to ./jdv_data on host machine
  "gobysoft/jaiabot-sim:2.0.0" Identifies the image to run the user should change this to the image they want
  "/bin/bash -li Tells docker to launch a bash shell
```

#### Stop the simulator

The following command will shut down the simulator, stop the container and remove it.

`docker stop jaia-sim-container`

## Using JCC

At this point the simulation is up and running in the docker container and the user simply needs to open a browser and open the following URL

http://localhost:40001/

## Using JDV

JDV can be used by opening the following URL. (note launching JDV from the Hub Details panel of JCC in simulation is not supported at this time.)

http://localhost:40011/

## Working with images locally (advanced, Linux platforms only)

This section is intended for experienced Linux users only. Building and managing images locally is not recommended on other platforms, please use pre-built images.

_All commands should be executed in the `jaiabot/scripts/sim-docker directory`_

- Build the image**  (advanced)

`./build-image.sh`

- builds `2.y-continuous` image locally
- tags image `jaiauser:jaia-sim-image`

**Launch the container**

`./launch-container.sh`

- This will launch the Docker container to run the simulation.

**Save the image**

`./save-image.sh`

- This save the Docker Image to a file for transport.
- The file will be named ./jaia-sim-image.tar.gz.

**Load the image**

`./load-image.sh`

- This load the Docker Image from the file jaia-sim-image.tar.gz.
- The file should be in the local directory when the script is run.

**Other useful Docker commands**

`docker images` This will list all available images on your machine.

```
  REPOSITORY   TAG                  IMAGE ID       CREATED             SIZE
  jaiauser     jaia-sim-image       777cba4e942c   About an hour ago   5.46GB
```

`docker ps` This will list all running Docker containers.

```
  CONTAINER ID   IMAGE                          COMMAND                  CREATED          STATUS          PORTS     NAMES
  f377d7195cfc   jaiauser:jaia-sim-image        "/bin/bash -li /entr…"   28 minutes ago   Up 28 minutes             jaia-sim-container
```

`docker stop <container-id>` This will stop the running container.

`docker rm <container-id>` This can be used to remove a stopped container if needed.


`docker rmi <image-id>` This can be used to remove an image. Note if an image is used by a container, even one that is stopped, you will not be able to remove it. You must first remove the container.

`docker exec -it jaia-sim-container bash` This can be used to log into a running container. This can be useful if you want to monitor how things are running.
