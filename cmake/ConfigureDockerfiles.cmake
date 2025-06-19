set(CMAKE_MODULE_PATH "${CMAKE_SOURCE_DIR}/cmake/")

include(JaiaVersions)
include(ReadCommonVersions)

if(PROJECT_GIT_BUILD)
  if(PROJECT_VERSION_GITBRANCH)
    set(JAIABOT_BRANCH_FOR_DOCKER "${PROJECT_VERSION_GITBRANCH}")
  else()
    execute_process(COMMAND git describe --tags HEAD
      WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
      OUTPUT_VARIABLE JAIABOT_BRANCH_FOR_DOCKER)
  endif()
else()
  set(JAIABOT_BRANCH_FOR_DOCKER "${PROJECT_VERSION}")
endif()

set(DOCKERFILES
  ${CMAKE_SOURCE_DIR}/.docker/noble/amd64/Dockerfile.in
  ${CMAKE_SOURCE_DIR}/.docker/noble/arm64/Dockerfile.in
  ${CMAKE_SOURCE_DIR}/scripts/sim-docker/Dockerfile.in
  ${CMAKE_SOURCE_DIR}/scripts/test-setup-build/Dockerfile.in
  )

foreach(I ${DOCKERFILES})
  string(REPLACE ".in" "" OUT ${I})
  configure_file(${I} ${OUT} @ONLY)

  # make Dockerfile same owner as Dockerfile.in
  execute_process(
    COMMAND chown --reference=${I} ${OUT}
    )
  
endforeach()
