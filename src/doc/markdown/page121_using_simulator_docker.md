# Using the Jaiabot Simulator in Docker

- [Using the Jaiabot Simulator in Docker](#using-the-jaiabot-simulator-in-docker)
  - [Install Docker](#install-docker)
  - [Download pre-built Docker images](#download-pre-built-docker-images)
  - [Run the Simulator](#run-the-simulator)
    - [Using docker compose](#using-docker-compose)
    - [Start the simulator](#start-the-simulator)
    - [Stop the simulator](#stop-the-simulator)
  - [Using JCC](#using-jcc)
  - [Using JDV](#using-jdv)
  - [Using Jaia REST API](#using-jaia-rest-api)
    - [Example](#example)
  - [Appendix: Advanced Use](#appendix-advanced-use)
    - [Using docker run](#using-docker-run)
    - [Start the simulator](#start-the-simulator-1)
    - [Stop the simulator](#stop-the-simulator-1)
    - [Working with images locally (Linux platforms only)](#working-with-images-locally-linux-platforms-only)

## Install Docker

The user must install Docker on their host machine. See https://www.docker.com/get-started/

The user must use a terminal/command prompt environment to run the Jaiabot Docker Simulation. Desktop versions of docker do not support all of the options used.  Depending on how docker was installed you may need to launch the desktop app to start the docker engine.

A few important Docker terms:

- _image_ - refers to a self contained runtime environment
- _container_ - refers to a running instance of an image

## Download pre-built Docker images

As of 2.0.0 release the Jaiabot Docker Simulation images are generated for both AMD64 and ARM64 host machines and pushed to the [Gobysoft Dockerhub](https://hub.docker.com/r/gobysoft/jaiabot-sim/tags) with each release of Jaiabot software.

- Available images can be found at- [https://hub.docker.com/r/gobysoft/jaiabot-sim/tags](https://hub.docker.com/r/gobysoft/jaiabot-sim/tags) .
- Open the URL in a browser


  - Choose the `<tag>` of the version you want (e.g. `2.1.0`, `2.y-beta`, `2.y-continuous`, or `2.y-test` )for the latest of the respective repository.

  - You do not need to specify the architecture in the tag (arm vs. amd), docker will pull the appropriate image for your machine architecture.

  - Use the "Copy" button on the web page to copy the pull command.
- Open the Terminal app on your system
- Check that docker engine is running

  - `docker ps -a`
    - if you get an error launch your Docker Desktop app
- Paste or type the docker pull command into your Terminal app

  -  `docker pull gobysoft/jaiabot-sim:2.y-continuous`
- Check image in the Terminal

  - `docker images` will list all available images on your machine.  You should see one that looks like
    ```
    REPOSITORY                   TAG                    IMAGE ID       CREATED        SIZE
    gobysoft/jaiabot-sim         2.0.0                  751dc04f83a9   21 hours ago   2.68GB
    ```

## Run the Simulator

### Using docker compose

Docker compose provides a platform-independent way to configure and run docker containers.  The easiest way to launch the JAIA Simulator in docker is to use a `docker-compose.yml` file.

* Open a browswer
* Copy example file from [docker-compose.yml](https://github.com/jaiarobotics/jaiabot/tree/2.y/scripts/sim-docker/docker-compose.yml)  

* This file will be used in the Terminal app to launch the simulator, 
  * copy the file to the folder you plan to run simulator from.  
*  You can edit the file using any standard text editor.
   *  `image:` the image and tag you want to run 
      * best practice is to pull the image before launching the simulator
      * docker will pull the image if it is not found local and exists on the hub 
   * `environment:` Set Jaia sim envoronment variables to configure the simulator
   * `ports:` Defines the ports used by the sim, do not edit
   * `volumes:` Maps local directory to JDV data directory in the sim container
     * replace `./jdv_data` with local folder you want to use
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

### Start the simulator

* Open the Terminal app
* Change to the directory with the `docker-compose.yml` file
* Start the simulator from the Terminal (includes JCC, JDV, REST API).
  * `docker compose up -d jaia-sim`
* Simulator will be running in a background container
* Check the status of the conatainer
  * `docker ps`

### Stop the simulator

* In Terminal app
* Open the Terminal app
* Change to the directory with the `docker-compose.yml` file
* Stop the simulator from the Terminal
  * `docker compose down`


## Using JCC

At this point the simulation is up and running in the docker container and the user simply needs to open a browser and open the following URL

* Open in a browser
  * http://localhost:40001/


## Using JDV

JDV can be used by opening the following URL. (Note: launching JDV from the Hub Details panel of JCC in simulation is not supported at this time.)

* Open in a browser
  * http://localhost:40011/

## Using Jaia REST API

The Jaia REST API can be exercised in the Docker simulation by submitting the appropriate URLs in a web browser using the api_key "simulation".

For more information on using the REST API see [REST API](http://52.36.157.57/md_page12_rest_api.html)

### Example

**Get status of bot #2**
* Submit URL in Bro

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

## Appendix: Advanced Use

The commands in this section should be run in a terminal using the bash shell.

### Using docker run

If the user does not want to use docker compose, the simulation can also be run using the `docker run` command.

### Start the simulator

`docker run --rm --name jaia-sim-container -d -i -t -p 40001:40001 -p 9092:9092 -p 40011:40011 --env JAIA_SIM_BOTS=5 --env JAIA_SIM_WARP=3 --env JAIA_SIM_FLEET=30 -v ./jdv_data:/var/log/jaiabot/bot_offload gobysoft/jaiabot-sim:2.0.0 /bin/bash`

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
  "gobysoft/jaiabot-sim:2.0.0" Identifies the image to run the user should change this to the image they want
  "/bin/bash" Tells docker to launch a bash shell
```

### Stop the simulator

The following command will shut down the simulator, stop the container and remove it.

`docker stop jaia-sim-container`

### Working with images locally (Linux platforms only)

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

- This saves the Docker Image to a file for transport.
- The file will be named ./jaia-sim-image.tar.gz.

**Load the image**

`./load-image.sh`

- This loads the Docker Image from the file jaia-sim-image.tar.gz.
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
