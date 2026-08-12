# Using the Jaiabot Simulator in Docker

- [Introduction](#introduction)
  - [Install Docker](#install-docker)
  - [Using Docker to run the Jaia Simulator](#using-docker-to-run-the-jaia-simulator)
- [Run the Jaia Simulator in Docker](#run-the-jaia-simulator-in-docker)
- [Open JCC](#open-jcc)
- [Open JDV](#open-jdv)
- [Stop the simulator](#stop-the-simulator)
- [Congfigure the Simulator](#congfigure-the-simulator)
- [Additional Features](#additional-features)
  - [Use the Jaia REST API](#use-the-jaia-rest-api)
    - [Example](#example)
  - [Manage additional Docker images lcoally](#manage-additional-docker-images-lcoally)
- [Appendix: Advanced Use](#appendix-advanced-use)
  - [Using docker run](#using-docker-run)
  - [Start the simulator](#start-the-simulator)
  - [Stop the simulator](#stop-the-simulator-1)
  - [Working with images locally (Linux platforms only)](#working-with-images-locally-linux-platforms-only)

## Introduction

Docker allows applications to run in environments other than the one they were developed for by encapsulating the application in a container.  The container will run an image, which is a self contained run time environment for the application.  The Jaia Simulator, including JCC, JDV and the REST API can be run on any machine using Docker.

### Install Docker

We recommend installing Docker Desktop for your host machine as this provides all of the Docker tools necessary with a single installation.  The installation of Docker Desktop is outside of the scope of this document.  Docker provides very good documentation on thier website.

Basic steps

1. Open a browser.
2. Open Docker Desktop webpage [https://docs.docker.com/desktop/](https://docs.docker.com/desktop/) .
3. At the bottom of the page there should be section titled "Install Docker Desktop" with links for different operating systems.
4. Click the link for the instructions for your machine.
5. Follow instructions on page.

### Using Docker to run the Jaia Simulator

Installing Docker Desktop installs all the tools needed to run the Jaia Simulator.  However, the Docker Desktop application can not be used to launch the Jaia Simulator directly.
The user will use a terminal/command prompt environment to run the Jaiabot Docker Simulation. Detailed instructions follow.

## Run the Jaia Simulator in Docker

1. Open the Docker Desktop application.  This insures all Docker services are running.
2. Open a browser.
3. Enter the URL [https://github.com/jaiarobotics/jaiabot/tree/3.y/scripts/sim-docker/docker-compose.yml](https://github.com/jaiarobotics/jaiabot/tree/3.y/scripts/sim-docker/docker-compose.yml)
4. Download the `docker-compose.yml` file.  
   * Above the code on the right there is download button to download the raw file to your computer (down arrow) .
6. Open your Downloads folder and move the `docker-compose.yml` file to your home folder.
7. Open your Terminal app (Windows Powershell, Mac Terminal, Ubuntu Terminal).
8. Change to your home folder.
9. Create a `jdv_data` folder in your home folder.  This will be used to access JDV data in the container
   * example: `mkdir jdv_data`
11. Enter the following command.
    * `docker compose up -d jaia-sim` .
    
12. The Jaia Simulator (includes JCC, JDV, REST API) will be now running in a background container

## Open JCC

1. Open a browser.
2. Enter the URL http://localhost:40001/ .

## Open JDV

1. Open a browser.
2. Enter the URL http://localhost:40011/ .

## Stop the simulator

1. Open the Terminal app.
2. Change to your home folder.
3. Enter the following command.
   * `docker compose down`

## Congfigure the Simulator

Docker compose provides a platform-independent way to configure and run docker containers.  The user can configure the JAIA Simulator simply by editing the `docker-compose.yml` file.

1. Open a browser.
2. Copy example file from [https://github.com/jaiarobotics/jaiabot/tree/3.y/scripts/sim-docker/docker-compose.yml](https://github.com/jaiarobotics/jaiabot/tree/3.y/scripts/sim-docker/docker-compose.yml) .
3. This file will be used in the Terminal app to launch the simulator.

   * copy the file to your home folder.
4. You can edit the  `docker-compose.yml` file using any standard text editor.

   * `image:` the image and tag you want to run
     * docker will automatically pull the image from the hub if needed
   * `environment:` Set Jaia sim envoronment variables to configure the simulator
   * `ports:` Defines the ports used by the sim, do not edit
   * `volumes:` Maps local folder to JDV data folder in the sim container
     * replace `./jdv_data` with other local folder if needed
     * do not edit `/var/log/jaiabot/bot_offload`

Example:

```
# Docker Compose file for launching the JAIA Simulator
# To launch the simulator 
# docker compose up -d jaia-sim
# To stop the simulator
# docker compose down

services:

  jaia-sim:
    image: gobysoft/jaiabot-sim:3.y-continuous   # image to use for simulation
    container_name: jaia-sim-container     # name of container for simulation

    # Simulation Environment
    environment:
      JAIA_SIM_BOTS: 5
      JAIA_SIM_WARP: 3
      JAIA_SIM_FLEET: 30

    # Expose necessary ports for simulation communication
    # All ports will be available at localhost
    ports:
      - "40001:40001"      # JCC 
      - "40011:40011"      # JDV
      - "9092:9092"        # REST API

    volumes:
      # shared folder mapping for JDV, replace "./jdv_data" with other folder as needed
      - ./jdv_data:/var/log/jaiabot/bot_offload

    stdin_open: true # Include stdin and tty so user can attach to running container
    tty: true
    restart: "no" # Remove the container after running

```
## Additional Features

### Use the Jaia REST API

The Jaia REST API can be exercised in the Docker simulation by submitting the appropriate URLs in a web browser using the api_key "simulation".

For more information on using the REST API see [REST API](http://52.36.157.57/md_page12_rest_api.html) .

#### Example

**Get status of bot #2**

1. Open a browser.
2. Submit URL in browser.

* `http://localhost:9092/jaia/v1/status/b2?api_key=simulation`

returns

```
{
  "request": {
    "api_key": "simulation",
    "status": true,
    "target": {
      "bots": [2]
    }
  },
  "status": {
    "bots": [
      {
        "attitude": {
          "course_over_ground": 180,
          "heading": 166,
          "pitch": 85,
          "roll": -57
        },
        "battery_percent": 95,
        "bot_id": 2,
        "bot_type": "HYDRO",
        "calibration_status": 3,
        "depth": 0,
        "hdop": 1.01,
        "health_state": "HEALTH__OK",
        "link": "LINK_WIFI",
        "location": {
          "lat": 41.661405,
          "lon": -71.272252
        },
        "mission_state": "PRE_DEPLOYMENT__IDLE",
        "pdop": 2.2,
        "received_time": "1744898838214380",
        "salinity": 20,
        "speed": {
          "over_ground": 0
        },
        "temperature": 14.96,
        "time": "1744898838000000",
        "wifi_link_quality_percentage": 100
      }
    ]
  },
  "target": {
    "bots": [2]
  }
}
```
### Manage additional Docker images lcoally

Jaiabot Docker Simulation images are generated for both AMD64 and ARM64 host machines and pushed to the [Gobysoft Dockerhub](https://hub.docker.com/r/gobysoft/jaiabot-sim/tags) with each release of Jaiabot software.  The examples above will download the 3.y-continuous image.  If the user wishes to use a different version of the simulator they can simply edit the image tag as described above.  If the user wishes to manage multiple images on thier machine they can use the following instructions.

1. Open a browser.
2. Enter URL [https://hub.docker.com/r/gobysoft/jaiabot-sim/tags](https://hub.docker.com/r/gobysoft/jaiabot-sim/tags) .
3. Choose the `<tag>` of the version you want (e.g. `3.0.0`, `3.y-beta`, `3.y-continuous`, or `3.y-test` )for the latest of the respective repository.

   * You do not need to specify the architecture in the tag (arm vs. amd), docker will pull the appropriate image for your machine architecture.
   * Use the "Copy" button on the web page to copy the pull command.
4. Open the Terminal app on your system.

5. Check that docker engine is running.

   * `docker ps -a`
     * if you get an error launch your Docker Desktop app.
6. Paste or type the docker pull command into your Terminal app.

   * `docker pull gobysoft/jaiabot-sim:3.y-continuous`
7. Check image in the Terminal.

   * `docker images` will list all available images on your machine.  You should see one that looks like the folowing.

     ```
     REPOSITORY                   TAG                    IMAGE ID       CREATED        SIZE
     gobysoft/jaiabot-sim         2.0.0                  751dc04f83a9   21 hours ago   2.68GB

     ```

## Appendix: Advanced Use

The commands described in this section need to be run in a Terminal app.

### Using docker run

If the user does not want to use docker compose, the simulation can also be run using the `docker run` command.

### Start the simulator

`docker run --rm --name jaia-sim-container -d -i -t -p 40001:40001 -p 9092:9092 -p 40011:40011 --env JAIA_SIM_BOTS=5 --env JAIA_SIM_WARP=3 --env JAIA_SIM_FLEET=30 -v ./jdv_data:/var/log/jaiabot/bot_offload gobysoft/jaiabot-sim:3.y-continuous /bin/bash`

Explanation of command.

```
  "docker run" Command to run the image in a new container 
  "--rm" Tells docker to remove the container after it is stopped
  "--name jaia-sim-container" Names the container "jaia-sim-container"
  "-d -i -t" Tells docker to run in a detached mode and to include an interactive terminal. This allows the user to log into the running container if needed (advanced)
  "-p 40001:40001" Exposes the port used by JCC to the host machine
  "-p 9092:9092" Exposes the port used for the REST API to the host machine
      - Example: Rest API -> http://localhost:9092/jaia/v1/status/all?api_key=simulation
  "-p 40011:40011" Exposes the port used by JDV to the host machine
  "--env JAIA_SIM_BOTS=5" Number of bots used in sim
  "--env JAIA_SIM_WARP=3" Warp factor used in sim
  "--env JAIA_SIM_FLEET=30" Fleet number used in sim
  "-v ./jdv_data:/var/log/jaiabot/bot_offload" Mounts the bot_offload folder in the container to ./jdv_data on host machine
  "gobysoft/jaiabot-sim:3.y-continuous" Identifies the image to run the user should change this to the image they want
  "/bin/bash" Tells docker to launch a bash shell
```

### Stop the simulator

The following command will shut down the simulator, stop the container and remove it.

`docker stop jaia-sim-container`

### Working with images locally (Linux platforms only)

This section is intended for experienced Linux users only. Building and managing images locally is not recommended on other platforms, please use pre-built images.

_All commands should be executed in the `jaiabot/scripts/sim-docker` folder_

* Build the image**  (advanced)

`./build-image.sh`

* builds `3.y-continuous` image locally
* tags image `jaiauser:jaia-sim-image`

**Launch the container**

`./launch-container.sh`

* This will launch the Docker container to run the simulation.

**Save the image**

`./save-image.sh`

* This saves the Docker Image to a file for transport.
* The file will be named ./jaia-sim-image.tar.gz.

**Load the image**

`./load-image.sh`

* This loads the Docker Image from the file jaia-sim-image.tar.gz.
* The file should be in the local folder when the script is run.

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
