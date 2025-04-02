# Creating an ARM64 image form deb package to run JAIA Simulation on a Mac

## Dockerfile

Updated Dockerfile.in to install everything from pre-built packages instead of building from source.

Used `2.y` versions of all packages to avoid issues with `pip install` items

Development is being done on branch `bug/2.y/docker-simulator-metadata-mac/JAIA-19

#### Dockerfile.in

see file in branch

## Creating Initial Image

Build on host machine of tartget, cross compiling is very slow.

`docker build  --no-cache -t jaiauser:jaia-sim-image .`

### 

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

The launch scripts in `config/launch/simulation` have been edited with the necessary changes.  References to `goby_liaison_jaiabot` were eliminated in cmake files and other scripts

#### bot.launch

see file in branch

#### hub.launch

see file in branch

### Getting JCC Running

Launched JCC from `/usr/share/jaiabot/web/server/` by first activating `venv`

```
root@9a7f65d7bbef:/usr/share/jaiabot/web/server# source /usr/share/jaiabot/python/venv/bin/activate
(venv) root@9a7f65d7bbef:/usr/share/jaiabot/web/server# ./app.py localhost

```

## Circleci Building and Pushing Docker Images

circleci job `docker-sim` split into `docker-sim-arm64` & `docker-sim-`amd64` to build and push the Docker Sim image to https://hub.docker.com/r/gobysoft/jaiabot-sim-arm64/tags & https://hub.docker.com/r/gobysoft/jaiabot-sim-amd64/tags

Currently being built as test builds on branch `bug/2.y/docker-simulator-metadata-mac/JAIA-1929`

## TODO

* Replace static Dockerfile with Dockerfile.in
  * DONE
* Test new Dockerfile.in builing of images for both AMD and ARM architectures
  * DONE
  * Tested on Ubuntu, passed after editing 2 launch scripts
  * install cmake on Mac and run the same way as on Ubuntu
    * built and tested image from Dockerfile.in with cmake on Mac, however needed to edit the cmake file
    * image ran fine
    * will create images in circleci to avoid having to deal with Mac Unix oddities
* Find a way to get around the library versioning so we do not need to edit the launch scripts.
  * DONE updated launch scripts
* Update circleci to build both AMD and ARM docker images and push to the hub
  * Done
  * Need to remove test builds from config when done
* Create entry file to launch the sim and JCC
  * DONE
  * May need to adjust image names and update launch-container.sh
* Use `${JAIABOT_APT_REPO) ` as docker build --build-arg
  * DONE
  * Need to verify circleci builds
* Use Manifest when pushing separate images to make pulling simpler
  * (See Toby private message for details)
