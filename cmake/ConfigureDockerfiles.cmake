set(CMAKE_MODULE_PATH "${CMAKE_SOURCE_DIR}/cmake/")

include(ReadCommonVersions)

set(DOCKERFILES
  ${CMAKE_SOURCE_DIR}/.docker/focal/amd64/Dockerfile.in
  ${CMAKE_SOURCE_DIR}/.docker/focal/arm64/Dockerfile.in
  ${CMAKE_SOURCE_DIR}/scripts/sim-docker/Dockerfile.in
  ${CMAKE_SOURCE_DIR}/scripts/test-setup-build/Dockerfile.in
  )

foreach(I ${DOCKERFILES})
  string(REPLACE ".in" "" OUT ${I})
  configure_file(${I} ${OUT} @ONLY)
endforeach()
