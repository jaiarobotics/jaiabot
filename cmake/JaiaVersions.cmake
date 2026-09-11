# versions
# automatically patched in CircleCI build to correct version
set(PROJECT_VERSION_MAJOR "X")
set(PROJECT_VERSION_MINOR "Y")
set(PROJECT_VERSION_PATCH "Z")

if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/.git")
  set(PROJECT_GIT_BUILD 1)
  execute_process(COMMAND git rev-parse --short HEAD
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    OUTPUT_VARIABLE PROJECT_LAST_REV)
  execute_process(COMMAND git rev-parse HEAD
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    OUTPUT_VARIABLE PROJECT_VERSION_GITHASH)

  execute_process(COMMAND git branch --show-current
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    OUTPUT_VARIABLE PROJECT_VERSION_GITBRANCH)

  # --always avoids a hard git failure when no tags are reachable (e.g. a shallow clone)
  execute_process(COMMAND git describe --tags --always
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    OUTPUT_VARIABLE PROJECT_VERSION_GITDESCRIBE
    ERROR_QUIET)

  # Quoted so an empty match doesn't hard-error with too few arguments
  string(REGEX MATCH "([0-9]+)\\.([0-9]+)\\.([0-9]+)" _ "${PROJECT_VERSION_GITDESCRIBE}")
  if(CMAKE_MATCH_COUNT EQUAL 3)
    set(PROJECT_VERSION_MAJOR ${CMAKE_MATCH_1})
    set(PROJECT_VERSION_MINOR ${CMAKE_MATCH_2})
    set(PROJECT_VERSION_PATCH ${CMAKE_MATCH_3})
  else()
    message(WARNING "No version tags reachable from HEAD (shallow clone or tags not fetched?); using placeholder version ${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}.${PROJECT_VERSION_PATCH}")
  endif()

  message("MAJOR VERSION: ${PROJECT_VERSION_MAJOR}")
  message("MINOR VERSION: ${PROJECT_VERSION_MINOR}")
  message("PATCH VERSION: ${PROJECT_VERSION_PATCH}")

  if(PROJECT_LAST_REV)
    string(STRIP ${PROJECT_LAST_REV} PROJECT_LAST_REV)
  endif()

  if(PROJECT_VERSION_GITHASH)
    string(STRIP ${PROJECT_VERSION_GITHASH} PROJECT_VERSION_GITHASH)
  endif()

  if(PROJECT_VERSION_GITBRANCH)
    string(STRIP ${PROJECT_VERSION_GITBRANCH} PROJECT_VERSION_GITBRANCH)
  endif() 
 
  if(PROJECT_VERSION_GITDESCRIBE)
    string(STRIP ${PROJECT_VERSION_GITDESCRIBE} PROJECT_GIT_VERSION) 
  endif() 

  execute_process(COMMAND git rev-list ${PROJECT_GIT_VERSION}..HEAD --count
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    OUTPUT_VARIABLE PROJECT_REVS_SINCE_TAG)

  message("Project Revs Since Tag: ${PROJECT_REVS_SINCE_TAG}")

  if(PROJECT_REVS_SINCE_TAG)
    string(STRIP ${PROJECT_REVS_SINCE_TAG} PROJECT_REVS_SINCE_TAG)
  endif()

  execute_process(COMMAND git diff-index --quiet HEAD
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    RESULT_VARIABLE PROJECT_DIRTY_REV)
  if(PROJECT_DIRTY_REV EQUAL 0)
    set(PROJECT_DIRTY_REV_STRING "")
  else()
    set(PROJECT_DIRTY_REV_STRING "-dirty")
  endif()
  set(PROJECT_VERSION_PATCH "${PROJECT_VERSION_PATCH}+${PROJECT_REVS_SINCE_TAG}+g${PROJECT_LAST_REV}${PROJECT_DIRTY_REV_STRING}")
  set(PROJECT_VERSION_GITHASH "${PROJECT_VERSION_GITHASH}${PROJECT_DIRTY_REV_STRING}")
  message(STATUS "Compiling in Git source tree (branch: [${PROJECT_VERSION_GITBRANCH}], rev: ${PROJECT_VERSION_GITHASH}).")
else()
  set(PROJECT_GIT_BUILD 0)
  message(STATUS "Compiling from release tarball")
endif()

set(PROJECT_VERSION "${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}.${PROJECT_VERSION_PATCH}")
message(STATUS "Version: ${PROJECT_VERSION}")
set(PROJECT_SOVERSION "1")

# Intervehicle API version

# increment when DCCL messages change. See also src/lib/messages/CMakeLists.txt
# start at 1 as 0 would be used prior to introducing this version (goby::middleware::Group::broadcast_group == 0)
set(PROJECT_INTERVEHICLE_API_VERSION 24)
