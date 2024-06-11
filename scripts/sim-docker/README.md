# How to Use the Jaiabot Simulator in a Docker Container

User must install Docker on their host machine.  See https://www.docker.com/get-started/

A few important Docker terms:
* *image* - refers to a self contained run enviroment
* *container* - refers to a running instance of an image

*All commands should be executed in the `jaiabot/scripts/sim-docker directory`*

1.  **`$ ./build-image.sh`**
    * This will build the Docker image needed to run the simulator.
    * This will take a while.

2.  **Edit sim_env_vars.txt**
    * This file contains environment variables that will be used to set up the simulation:
        * JAIA_SIM_BOTS=3
        * JAIA_SIM_WARP=2
        * JAIA_SIM_FLEET=20

3.  **`$ ./launch-container.sh`**
    * This will launch the Docker container to run the simulation.
    * Becasue the web support needs to be built each time, it takes a while for everything to become available.
    * This may be longer than on your host machine, be patient.

4.  **Accessing Jaia web apps from the Docker container using your host machine browser**
    * Currently the Docker container supports the following web apps:
        * JCC
        * JED
        * Goby Liaison
    * The container shares the host network so all ports are the same as if the apps were running on the host machine.
    Because it is a shared network, you must specify the IP address `127.0.0.1` instead of using "localhost"
        * Example: JCC -> http://127.0.0.1:40001/

5.  **`$ ./save-image.sh`**
    * This save the Docker Image to a file for transport
    * file will be named ./jaia-sim-image.tar.gz

6.  **`$ ./load-image.sh`**
    * This load the Docker Image from the file jaia-sim-image.tar.gz
    * file should be in the local directory when the script is run
    
7. **Other Useful Docker commands**
    * This will list all available images on your machine.
        * `$ docker images`
        * ```
          REPOSITORY   TAG                  IMAGE ID       CREATED             SIZE
          jaiauser     jaia-sim-image       777cba4e942c   About an hour ago   5.46GB
          ```
   
    * This will list all running Docker containers.
        * `$ docker ps`
        * ```
          CONTAINER ID   IMAGE                          COMMAND                  CREATED          STATUS          PORTS     NAMES
          f377d7195cfc   jaiauser:jaia-sim-image        "/bin/bash -li /entr…"   28 minutes ago   Up 28 minutes             jaia-sim-container
          ```
    * This will stop the running container. The `jaiauser:jaia-sim-container` container
    is being launched by `launch-container.sh` such that it will remove itself when shut down.
        * `$ docker stop <container-id>`

    * This can be used to remove a stopped container if needed.
        * `$ docker rm <container-id>`

    * This can be used to remove an image. Note if an image is used by a container, even one that is stopped, you will not be able to remove it. You must first remove the container.
        * `$ docker rmi <image-id>`

    * This can be used to log into a running container. This can be useful if you want to monitor how things are running.
        * `$ docker exec -it jaia-sim-container bash`


