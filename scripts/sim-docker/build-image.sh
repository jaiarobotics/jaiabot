(cd ../..; cmake -P cmake/ConfigureDockerfiles.cmake)
docker build  --no-cache -t jaiauser:jaia-sim-image .
