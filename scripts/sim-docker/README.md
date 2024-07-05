# How to Use the Jaiabot Simulator in a Docker Container

User must install Docker on their host machine. See https://www.docker.com/get-started/

A few important Docker terms:

- _image_ - refers to a self contained run enviroment
- _container_ - refers to a running instance of an image

_All commands should be executed in the `jaiabot/scripts/sim-docker directory` for **Linux users**_

1.  **Build the image**
    
    - **Linux users:** `$ ./build-image.sh`
    - **Windows users:** `docker build --no-cache -t jaiauser:jaia-sim-image .`
      - First, copy the `Dockerfile` from the jaiabot repository (`jaiabot/scripts/sim-docker`).
      - Second, copy the `entrypoint.sh` script from the jaiabot repository (`jaiabot/scripts/sim-docker`).
      - These two files should live in the location where you run the docker build command.
    - This will build the Docker image needed to run the simulator.
    - This will take a while.

2.  **Edit sim_env_vars.txt**
    
    - This file contains environment variables that will be used to set up the simulation:
    - **Windows users** will need to create this file in the location where you plan on launching the container.
      - JAIA_SIM_BOTS=3
      - JAIA_SIM_WARP=2
      - JAIA_SIM_FLEET=20

3.  **Launch the container**
    
    - **Linux users:** `$ ./launch-container.sh`
    - **Windows users:** `docker run --rm --name jaia-sim-container -d -i -t --env-file sim_env_vars.txt -p "40001:40001" jaiauser:jaia-sim-image /bin/bash -li /entrypoint.sh`
    - This will launch the Docker container to run the simulation.

4.  **Accessing Jaia web apps from the Docker container using your host machine browser**

    - Currently the Docker container supports the following web apps:
      - JCC
      - JED
    - The container maps port 40001 to the corresponding host port, launch JCC as usual.
      - Example: JCC -> http://127.0.0.1:40001/
      - Example: JCC -> localhost:40001/
    - It may take a couple of minutes for the JCC to load.

5.  **Save the image**

    - **Linux users:** `$ ./save-image.sh`
    - **Windows users:** `docker image save jaiauser:jaia-sim-image | gzip > jaia-sim-image.tar.gz`
    - This save the Docker Image to a file for transport.
    - The file will be named ./jaia-sim-image.tar.gz.

6.  **Load the image**

    - **Linux users:** `$ ./load-image.sh`
    - **Windows users:** `docker load -i jaia-sim-image.tar.gz`
    - This load the Docker Image from the file jaia-sim-image.tar.gz.
    - The file should be in the local directory when the script is run.

7.  **Other useful Docker commands**

    - This will list all available images on your machine.
      - `$ docker images`
      - ```
        REPOSITORY   TAG                  IMAGE ID       CREATED             SIZE
        jaiauser     jaia-sim-image       777cba4e942c   About an hour ago   5.46GB
        ```
    - This will list all running Docker containers.
      - `$ docker ps`
      - ```
        CONTAINER ID   IMAGE                          COMMAND                  CREATED          STATUS          PORTS     NAMES
        f377d7195cfc   jaiauser:jaia-sim-image        "/bin/bash -li /entr…"   28 minutes ago   Up 28 minutes             jaia-sim-container
        ```
    - This will stop the running container. The `jaiauser:jaia-sim-container` container
      is being launched by `launch-container.sh` such that it will remove itself when shut down. \* `$ docker stop <container-id>`

    - This can be used to remove a stopped container if needed.

      - `$ docker rm <container-id>`

    - This can be used to remove an image. Note if an image is used by a container, even one that is stopped, you will not be able to remove it. You must first remove the container.

      - `$ docker rmi <image-id>`

    - This can be used to log into a running container. This can be useful if you want to monitor how things are running.
      - `$ docker exec -it jaia-sim-container bash`
