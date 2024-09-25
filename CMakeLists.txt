cmake_minimum_required(VERSION 3.5.1 FATAL_ERROR)
project(jaiabot CXX C)

set(CMAKE_MODULE_PATH "${CMAKE_SOURCE_DIR}/cmake/")

# require C++14
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

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

  execute_process(COMMAND git describe --tags
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    OUTPUT_VARIABLE PROJECT_VERSION_GITDESCRIBE)

  # Regular expression to extract major, minor, and patch numbers
  string(REGEX MATCH "([0-9]+)\\.([0-9]+)\\.([0-9]+)" _ ${PROJECT_VERSION_GITDESCRIBE})
  set(PROJECT_VERSION_MAJOR ${CMAKE_MATCH_1})
  set(PROJECT_VERSION_MINOR ${CMAKE_MATCH_2})
  set(PROJECT_VERSION_PATCH ${CMAKE_MATCH_3})
 
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
set(PROJECT_INTERVEHICLE_API_VERSION 10)

# find Protobuf
find_package(ProtobufLocal REQUIRED)
include_directories(${PROTOBUF_INCLUDE_DIRS})

# find NanoPB
find_package( Nanopb REQUIRED )

# find DCCL
find_package(DCCL REQUIRED)
get_target_property(DCCL_INCLUDE_DIR dccl INTERFACE_INCLUDE_DIRECTORIES)

message("Using DCCL in ${DCCL_INCLUDE_DIR}")
include_directories("${DCCL_INCLUDE_DIR}")
protobuf_include_dirs("${DCCL_INCLUDE_DIR}")

# find MOOS
find_package(MOOS 10 REQUIRED)

# find Goby3
find_package(GOBY 3.0 REQUIRED zeromq moos)

include_directories("${GOBY_INCLUDE_DIR}")
protobuf_include_dirs("${GOBY_INCLUDE_DIR}")

# create variables for various directories
get_filename_component(project_SRC_DIR src ABSOLUTE)
get_filename_component(project_BUILD_DIR ${CMAKE_BINARY_DIR} ABSOLUTE)
get_filename_component(project_SCRIPTS_DIR scripts ABSOLUTE)

# fetch all the local directories for generated code
get_filename_component(project_LIB_DIR ${project_BUILD_DIR}/lib ABSOLUTE)
get_filename_component(project_BIN_DIR ${project_BUILD_DIR}/bin ABSOLUTE)
get_filename_component(project_INC_DIR ${project_BUILD_DIR}/include ABSOLUTE)
get_filename_component(project_SHARE_DIR ${project_BUILD_DIR}/share ABSOLUTE)
file(MAKE_DIRECTORY ${project_SHARE_DIR})
get_filename_component(project_INTERMEDIATE_DIR ${project_BUILD_DIR}/intermediate ABSOLUTE)
file(MAKE_DIRECTORY ${project_INTERMEDIATE_DIR})

# Write the version to a simple text file for scripts to use
if(PROJECT_VERSION_GITHASH)
  file(WRITE ${project_SHARE_DIR}/version.txt ${PROJECT_VERSION_GITDESCRIBE})
endif()

## set the cmake defaults for libraries and binaries
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${project_LIB_DIR} CACHE PATH 
  "Output directory for the dynamic libraries" )
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${project_BIN_DIR} CACHE PATH
  "Output directory for the binaries" )
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${project_LIB_DIR} CACHE PATH 
  "Output directory for the static libraries (archives)" )

# include our local include directory
include_directories(${project_INC_DIR})
protobuf_include_dirs(${project_INC_DIR})

# settings for goby_clang_tool
option(build_doc "Build documentation (requires Doxygen)" OFF)
option(export_goby_interfaces OFF "Build Goby Publish/Subscribe interface files (YML) from code")

if(build_doc)
  set(export_goby_interfaces ON CACHE BOOL "Set export interfaces for documentation" FORCE)
endif()

if(export_goby_interfaces)
  include(GobyClangTool)
  set(YML_OUT_DIR ${project_SHARE_DIR}/jaiabot/interfaces)
endif()


find_program(ARDUINO_CLI arduino-cli)
if(ARDUINO_CLI)
  option(build_arduino "Build Arduino code (requires arduino-cli)" ON)
else()
  message(STATUS "Did not find arduino-cli, so not building arduino code")
  option(build_arduino "Build Arduino code (requires arduino-cli)" OFF)
endif()

option(build_web "Build web ui code (requires npm)" ON)
option(build_jdv "Build jdv ui code (requires npm)" ON)


# configure the headers to build/include
file(GLOB_RECURSE INCLUDE_FILES RELATIVE ${project_SRC_DIR}/lib
  src/lib/*.h
  )
file(GLOB_RECURSE PROTO_FILES RELATIVE ${project_SRC_DIR}/lib/messages
  src/lib/messages/*.proto
  )
file(GLOB_RECURSE NANOPB_OPTIONS_FILES RELATIVE ${project_SRC_DIR}/lib/messages
  src/lib/messages/*.options
  )

foreach(I ${INCLUDE_FILES})
  configure_file(${project_SRC_DIR}/lib/${I} ${project_INC_DIR}/jaiabot/${I} @ONLY)
endforeach()
foreach(I ${PROTO_FILES})
  configure_file(${project_SRC_DIR}/lib/messages/${I} ${project_INC_DIR}/jaiabot/messages/${I} @ONLY)
  configure_file(${project_SRC_DIR}/lib/messages/${I} ${project_INC_DIR}/jaiabot/messages/nanopb/${I} @ONLY)
endforeach()

foreach(I ${NANOPB_OPTIONS_FILES})
  configure_file(${project_SRC_DIR}/lib/messages/${I} ${project_INC_DIR}/jaiabot/messages/nanopb/${I} @ONLY)
endforeach()


## set instructions for `make install`

# override library version for debian sbuild cross-builds
if(CMAKE_CROSSCOMPILING)
  if (EXISTS "/etc/debian_version")
    set(CMAKE_INSTALL_LIBDIR "lib/${CMAKE_LIBRARY_ARCHITECTURE}")
  endif()
endif()

include(GNUInstallDirs)
# include
install(DIRECTORY ${project_INC_DIR}/ DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}
  FILES_MATCHING REGEX .*\\.h|.*\\.proto)

# bin
macro(project_install_bin target_bin)
  install(TARGETS ${target_bin} DESTINATION ${CMAKE_INSTALL_BINDIR})

  # set the macros required for jaiabot_health to map this app name to the appropriate ERROR__NOT_RESPONDING enum
  list(APPEND PROJECT_APP_LIST ${target_bin})
  set(PROJECT_APP_LIST ${PROJECT_APP_LIST} CACHE INTERNAL "project_app_list")
endmacro()

# lib
macro(project_install_lib target_lib)
  set_property(TARGET ${target_lib} APPEND PROPERTY INTERFACE_INCLUDE_DIRECTORIES
    $<BUILD_INTERFACE:${project_INC_DIR}>
    $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>  # <prefix>/include
    )

  set_target_properties(${target_lib} PROPERTIES VERSION "${PROJECT_VERSION}" SOVERSION "${PROJECT_SOVERSION}")
  
  install(TARGETS ${target_lib} EXPORT jaiabot-config
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}) 
  list(APPEND PROJECT_LIBRARY_LIST ${target_lib})
  set(PROJECT_LIBRARY_LIST ${PROJECT_LIBRARY_LIST} CACHE INTERNAL "project_library_list")
endmacro()

install(DIRECTORY ${project_SHARE_DIR}/ DESTINATION ${CMAKE_INSTALL_PREFIX}/share
  PATTERN "arduino" EXCLUDE # this is specially installed by ArduinoCompile.cmake
  )

unset(PROJECT_LIBRARY_LIST CACHE)
unset(PROJECT_APP_LIST CACHE)
 
# share
# install config
install(DIRECTORY ${CMAKE_SOURCE_DIR}/config DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)

# etc
option(install_motd "Install MOTD script" ON)
if(install_motd)
  install(PROGRAMS ${project_SCRIPTS_DIR}/75-jaiabot-status DESTINATION /etc/update-motd.d/)
endif()

option(install_ssh_authorized_keys "Install SSH authorized keys to /etc/jaiabot/ssh" ON)
if(install_ssh_authorized_keys)
  install(DIRECTORY ${CMAKE_SOURCE_DIR}/rootfs/customization/includes.chroot/etc/jaiabot/ssh DESTINATION /etc/jaiabot)
endif()


install(PROGRAMS ${project_SCRIPTS_DIR}/75-jaiabot-status DESTINATION ${CMAKE_INSTALL_BINDIR} RENAME jaiabot-status)

# for use by Docker build install
file(MAKE_DIRECTORY ${project_BIN_DIR})

set(scripts_to_install
  jaiabot-checkloadavg.py
  # data offload
  data-offload/jaiahub-dataoffload.sh
  data-offload/jaiabot-predataoffload.sh
  data-offload/jaiabot-postdataoffload.sh
  data-offload/jaiahub-dataoffload-cloudhub.sh
  # Firmware scripts
  jaia_firm_backup_date.sh
  geotiff_format.py
  geotiff_scan.sh
  # Utilities
  jaia-ip.py
  jaia-doc.py
)

# Iterate over each script to install and copy
foreach(script ${scripts_to_install})
    install(PROGRAMS ${project_SCRIPTS_DIR}/${script} DESTINATION ${CMAKE_INSTALL_BINDIR})
    configure_file(${project_SCRIPTS_DIR}/${script} ${project_BIN_DIR} COPYONLY)
endforeach()


option(enable_testing "Enable building of tests using CTest (if set to ON, you can run tests with 'make test')" OFF)
if(enable_testing)
  enable_testing()
  include(CTest)
endif()

# add the code
add_subdirectory(src)


if(export_goby_interfaces)
  set(INTERFACE_COMMON_PARAMS "--omit-group-regex=jaiabot::state_change;--omit-node-regex='.*statechart::Notify.*'")
  generate_interfaces_figure(${project_SRC_DIR}/doc/deployment/simulation_deployment.yml ${YML_OUT_DIR} simulation_interfaces.svg "--no-disconnected;${INTERFACE_COMMON_PARAMS}")
  generate_interfaces_figure(${project_SRC_DIR}/doc/deployment/simulation_deployment.yml ${YML_OUT_DIR} simulation_interfaces_inc_unused.svg "${INTERFACE_COMMON_PARAMS}")
  generate_interfaces_figure(${project_SRC_DIR}/doc/deployment/runtime_deployment.yml ${YML_OUT_DIR} runtime_deployment.svg "--no-disconnected;${INTERFACE_COMMON_PARAMS}")
  generate_interfaces_figure(${project_SRC_DIR}/doc/deployment/runtime_deployment.yml ${YML_OUT_DIR} runtime_deployment_inc_unused.pdf "${INTERFACE_COMMON_PARAMS}")
endif()

# configuration export - installed version
install(EXPORT jaiabot-config DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/jaiabot)
# configuration export - local build version
export(TARGETS ${PROJECT_LIBRARY_LIST} FILE ${CMAKE_BINARY_DIR}/jaiabot-config.cmake)
