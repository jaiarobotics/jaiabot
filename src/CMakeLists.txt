add_subdirectory(lib)
add_subdirectory(bin)
add_subdirectory(python)

if(build_doc)
  find_package(Doxygen REQUIRED dot)
  add_subdirectory(doc)
  
  # doc install
  install(DIRECTORY ${project_BUILD_DIR}/src/doc/html DESTINATION share/doc/jaiabot)
  install(DIRECTORY ${project_BUILD_DIR}/src/doc/figures DESTINATION share/doc/jaiabot)
  install(DIRECTORY ${project_BUILD_DIR}/src/doc/markdown DESTINATION share/doc/jaiabot)

endif()

# library with all the config.protos
file(GLOB_RECURSE CONFIG_PROTOS  RELATIVE ${CMAKE_CURRENT_SOURCE_DIR}  "bin/*/config.proto")

protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS
  ${project_INC_DIR}
  ${CONFIG_PROTOS}
  )
add_library(jaiabot_config SHARED ${PROTO_SRCS} ${PROTO_HDRS})
target_link_libraries(jaiabot_config ${PROTOBUF_LIBRARIES} jaiabot_messages goby goby_zeromq goby_moos)
project_install_lib(jaiabot_config)

if(build_arduino)
  include(ArduinoCompile)
  add_subdirectory(arduino)
endif()

if(build_web)
  add_subdirectory(web)
endif()

if(enable_testing)
  add_subdirectory(test)
endif()
