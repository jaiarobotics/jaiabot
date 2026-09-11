# Add a jaiabot application written in Python against the Goby3 Python bindings.
#
# add_jaiabot_python_app(TARGET jaiabot_driver_tsys01
#                        MAIN jaiabot_driver_tsys01.py
#                        SUBDIR tsys01_temperature_sensor
#                        INCLUDES header1.h;header2.h)
#
# Wraps goby_add_python_app with the conventions this project needs:
#   - the extension module and its generated Python module land in lib/jaiabot/python, which is
#     packaged separately from the pure-Python half because they are architecture-dependent
#   - protobuf Python modules come from the pyjaiaprotobuf target rather than being regenerated
#   - JAIA_PYTHON_APP_PYTHONPATH accumulates what every driver needs on its PYTHONPATH

include(GobyPython)

set(JAIA_PYTHON_APP_DIR "${project_LIB_DIR}/jaiabot/python"
  CACHE INTERNAL "Where generated Goby Python extension modules are written")

function(add_jaiabot_python_app)
  cmake_parse_arguments(args "" "TARGET;MAIN;SUBDIR" "INCLUDES;LINK_LIBRARIES" ${ARGN})

  if(NOT args_TARGET)
    message(FATAL_ERROR "You must provide a TARGET")
  endif()
  if(NOT args_SUBDIR)
    message(FATAL_ERROR "You must provide a SUBDIR")
  endif()

  goby_add_python_app(
    TARGET ${args_TARGET}
    INTERFACE_YML ${CMAKE_CURRENT_SOURCE_DIR}/interface.yml
    OUTPUT_DIRECTORY ${JAIA_PYTHON_APP_DIR}
    INCLUDES goby/zeromq/application/single_thread.h
             jaiabot/groups.h
             jaiabot/messages/python_driver_config.pb.h
             ${args_INCLUDES}
    PROTO_MODULES jaiabot.messages.python_driver_config_pb2
    LINK_LIBRARIES goby goby_zeromq jaiabot_messages jaiabot_python_driver_config ${args_LINK_LIBRARIES})

  # the configuration and message types are resolved by name at startup, so the modules
  # pyjaiaprotobuf generates have to exist before the app can run
  add_dependencies(${args_TARGET} pyjaiaprotobuf)
  target_include_directories(${args_TARGET} PRIVATE ${project_INC_DIR})
endfunction()
