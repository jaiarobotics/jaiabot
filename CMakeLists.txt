cmake_minimum_required(VERSION 3.28.3...4.2.3 FATAL_ERROR)

project(jaiabot CXX C)

set(CMAKE_MODULE_PATH "${CMAKE_SOURCE_DIR}/cmake/")

# require minimum C++ version
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Limit cascading C++ errors (GCC / Clang only)
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU")
  add_compile_options(-fmax-errors=3)
elseif(CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-ferror-limit=3)
endif()

# determine version of jaiabot
include(JaiaVersions)

# find Protobuf
include(JaiaProtobuf)

# find NanoPB
find_package( Nanopb REQUIRED )

# find DCCL
find_package(DCCL REQUIRED)
get_target_property(DCCL_INCLUDE_DIR dccl INTERFACE_INCLUDE_DIRECTORIES)

message("Using DCCL in ${DCCL_INCLUDE_DIR}")
include_directories("${DCCL_INCLUDE_DIR}")

# find MOOS
find_package(MOOS 10 REQUIRED)

# find Goby3
find_package(GOBY 3.0 REQUIRED zeromq moos)

include_directories("${GOBY_INCLUDE_DIR}")

# create variables for various directories
get_filename_component(project_SRC_DIR src ABSOLUTE)
get_filename_component(project_ROOTFS_DIR rootfs ABSOLUTE)
get_filename_component(project_BUILD_DIR ${CMAKE_BINARY_DIR} ABSOLUTE)
get_filename_component(project_SH_DIR src/sh ABSOLUTE)

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

# settings for jaia_state_tool (boost::statechart state diagram generation)
option(build_state_diagrams "Build Graphviz and Mermaid state diagrams (PDF) from boost::statechart code (requires Clang 18 dev libraries; optionally graphviz dot and/or mmdc for PDF rendering)" OFF)

if(build_state_diagrams)
  include(JaiaStateTool)
  set(STATE_DIAGRAM_OUT_DIR ${project_SHARE_DIR}/jaiabot/state_diagrams)
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
  configure_file(${project_SRC_DIR}/lib/messages/${I} ${project_INC_DIR}/nanopb/jaiabot/messages/${I} @ONLY)
endforeach()

foreach(I ${NANOPB_OPTIONS_FILES})
  configure_file(${project_SRC_DIR}/lib/messages/${I} ${project_INC_DIR}/nanopb/jaiabot/messages/${I} @ONLY)
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


# Install these init files so that they are accessible to CloudHub for VirtualFleet generation
file(COPY ${project_ROOTFS_DIR}/customization/includes.chroot/etc/jaiabot/init/common-first-boot.yml DESTINATION ${project_SHARE_DIR}/jaiabot/init/)
file(COPY ${project_ROOTFS_DIR}/customization/includes.chroot/etc/jaiabot/init/first-boot.preseed.yml.j2 DESTINATION ${project_SHARE_DIR}/jaiabot/init/)

install(DIRECTORY ${project_SHARE_DIR}/ DESTINATION ${CMAKE_INSTALL_PREFIX}/share
  PATTERN "arduino" EXCLUDE # this is specially installed by ArduinoCompile.cmake
  PATTERN "interfaces/figures" EXCLUDE # any figures are built to doc directory
  )

unset(PROJECT_LIBRARY_LIST CACHE)
unset(PROJECT_APP_LIST CACHE)
 
# share
# install config
install(DIRECTORY ${CMAKE_SOURCE_DIR}/config DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)

# etc
option(install_motd "Install MOTD script" ON)

option(install_profile "Install /etc/profile.d script providing the jaia environment to login shells" ON)

option(install_ssh_authorized_keys "Install SSH authorized keys to /etc/jaiabot/ssh" ON)
if(install_ssh_authorized_keys)
  install(DIRECTORY ${CMAKE_SOURCE_DIR}/config/ssh DESTINATION /etc/jaiabot)
endif()

# for use by Docker build install
file(MAKE_DIRECTORY ${project_BIN_DIR})

option(enable_testing "Enable building of tests using CTest (if set to ON, you can run tests with 'make test')" OFF)
if(enable_testing)
  enable_testing()
  include(CTest)
endif()

# add the code
add_subdirectory(src)

add_custom_target(jaiabot_core)
foreach(app_target ${PROJECT_APP_LIST})
  add_dependencies(jaiabot_core ${app_target})
endforeach()

if(export_goby_interfaces)
  set(INTERFACE_COMMON_PARAMS "--omit-group-regex=jaiabot::state_change;--omit-node-regex='.*statechart::Notify.*'")
  generate_interfaces_figure(${project_SRC_DIR}/doc/deployment/simulation_deployment.yml ${YML_OUT_DIR} simulation_interfaces.svg "--no-disconnected;${INTERFACE_COMMON_PARAMS}")
  generate_interfaces_figure(${project_SRC_DIR}/doc/deployment/simulation_deployment.yml ${YML_OUT_DIR} simulation_interfaces_no_interthread.svg "--omit-interthread;--no-disconnected;${INTERFACE_COMMON_PARAMS}")
  generate_interfaces_figure(${project_SRC_DIR}/doc/deployment/simulation_deployment.yml ${YML_OUT_DIR} simulation_interfaces_inc_unused.svg "${INTERFACE_COMMON_PARAMS}")
  generate_interfaces_figure(${project_SRC_DIR}/doc/deployment/runtime_deployment.yml ${YML_OUT_DIR} runtime_deployment.svg "--no-disconnected;${INTERFACE_COMMON_PARAMS}")
  generate_interfaces_figure(${project_SRC_DIR}/doc/deployment/runtime_deployment.yml ${YML_OUT_DIR} runtime_deployment_inc_unused.pdf "${INTERFACE_COMMON_PARAMS}")
endif()

# configuration export - installed version
install(EXPORT jaiabot-config DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/jaiabot)
# configuration export - local build version
export(TARGETS ${PROJECT_LIBRARY_LIST} FILE ${CMAKE_BINARY_DIR}/jaiabot-config.cmake)

## Configure Dockerfiles
# Read common-version.env into CMake variables
include(ConfigureDockerfiles)
