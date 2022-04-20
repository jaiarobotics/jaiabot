cmake_minimum_required(VERSION 3.5.1 FATAL_ERROR)
project(jaiabot CXX C)

set(CMAKE_MODULE_PATH "${CMAKE_SOURCE_DIR}/cmake/")

# require C++14
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# versions
set(PROJECT_VERSION_MAJOR "1")
set(PROJECT_VERSION_MINOR "0")
set(PROJECT_VERSION_PATCH "0~alpha1")
set(PROJECT_VERSION "${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}.${PROJECT_VERSION_PATCH}")

set(PROJECT_SOVERSION "1")

# find Protobuf
find_package(ProtobufLocal REQUIRED)
include_directories(${PROTOBUF_INCLUDE_DIRS})

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

install(DIRECTORY ${project_SHARE_DIR}/ DESTINATION ${CMAKE_INSTALL_PREFIX}/share)

unset(PROJECT_LIBRARY_LIST CACHE)


# add the code
add_subdirectory(src)


if(export_goby_interfaces)
  set(INTERFACE_COMMON_PARAMS "--omit-group-regex=jaiabot::state_change;--omit-node-regex='.*statechart::Notify.*'")
  generate_interfaces_figure(${project_SRC_DIR}/doc/deployment/simulation_deployment.yml ${YML_OUT_DIR} simulation_interfaces.svg "--no-disconnected;${INTERFACE_COMMON_PARAMS}")
  generate_interfaces_figure(${project_SRC_DIR}/doc/deployment/simulation_deployment.yml ${YML_OUT_DIR} simulation_interfaces_inc_unused.svg "${INTERFACE_COMMON_PARAMS}")
  generate_interfaces_figure(${project_SRC_DIR}/doc/deployment/dev_deployment.yml ${YML_OUT_DIR} dev_deployment.svg "--no-disconnected;${INTERFACE_COMMON_PARAMS}")
  generate_interfaces_figure(${project_SRC_DIR}/doc/deployment/dev_deployment.yml ${YML_OUT_DIR} dev_deployment_inc_unused.pdf "${INTERFACE_COMMON_PARAMS}")
endif()

# configuration export - installed version
install(EXPORT jaiabot-config DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/jaiabot)
# configuration export - local build version
export(TARGETS ${PROJECT_LIBRARY_LIST} FILE ${CMAKE_BINARY_DIR}/jaiabot-config.cmake)
 
# install config
install(DIRECTORY ${CMAKE_SOURCE_DIR}/config DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)
