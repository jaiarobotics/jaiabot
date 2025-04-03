- [How to use the Jaiabot Simulator in a Docker](#how-to-use-the-jaiabot-simulator-in-a-docker)
  - [Install Docker](#install-docker)
  - [Download pre-built Docker images (preferred)](#download-pre-built-docker-images-preferred)
    - [Download the image](#download-the-image)
    - [Run the Simulator](#run-the-simulator)
      - [Setup the simulation](#setup-the-simulation)
      - [Launch the container](#launch-the-container)
    - [Using JCC](#using-jcc)
    - [Stopping the Simulation](#stopping-the-simulation)
  - [Working with images locally (advanced, Linux platforms only)](#working-with-images-locally-advanced-linux-platforms-only)

# How to use the Jaiabot Simulator in a Docker

## Install Docker

The user must install Docker on their host machine. See https://www.docker.com/get-started/

The user must use a terminal/command prompt environment to run the Jaiabot Docker Simulation.  Desktop versions of docker do not support all of the options used.  However, depending on how docker was installed you may need to launch the desktop app to start the docker engine.

A few important Docker terms:

- _image_ - refers to a self contained run enviroment
- _container_ - refers to a running instance of an image


## Download pre-built Docker images (preferred)

As of 2.y release the Jaiabot Docker Simulation images are generated for both AMD64 and ARM64 host machines and pushed to the Gobysoft Dockerhub with each release of Jaiabot software. 

### Download the image

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

### Run the Simulator

#### Setup the simulation

The fleet number, the number of bots and the simulation warp speed are specified in environment variables and passed to the simulator in a text file.  An example file is provided in the jaiabot repo `scripts/sim-docker/sim_env_vars.txt`

Users can edit the existing file or create their own locally.  Format of file is
```
JAIA_SIM_BOTS=3
JAIA_SIM_WARP=2
JAIA_SIM_FLEET=20
```
#### Launch the container

The following command will launch the Jaiabot Simulator in a Docker container.  This can be run from any directory but make sure `sim_env_vars.txt` is in that directory.

`docker run --rm --name jaia-sim-container -d -i -t -p 40001:40001 -p 9092:9092 --env-file sim_env_vars.txt gobysoft/jaiabot-sim:2.0.0 /bin/bash -li "/entrypoint.sh"`

Explanation of command.
```
  "docker run" Command to run the image in a new container 
  "--rm" Tells docker to remove the container after it is stopped
  "--name jaia-sim-container" Names the container "jaia-sim-container"
  "-d -i -t" Tells docker to run in a detached mode and to include an interactive terminal. This allows the user to log into the running container if needed (advanced)
  "--env-file sim_env_vars.txt" Specifies the file containing the environment variables used by the simulation
  "-p 40001:40001 -p 9092:9092 Exposes the ports used by JCC and Liaison to the host machine
  "gobysoft/jaiabot-sim:2.0.0" Identifies the image to run the user should change this to the image they want
  "/bin/bash -li "/entrypoint.sh" Tells docker to launch a bash shell and use the entrypoint.sh script to run the simulation and JCC
```

### Using JCC

At this point the simulation is up and running in the docker container and the user simply needs to open a browser and open the following URL

http://localhost:40001/

### Stopping the Simulation

The following command will stop the running container and remove it when done.

`docker stop jaia-sim-container`

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

