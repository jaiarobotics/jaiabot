include(JaiaApp)

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
file(GLOB_RECURSE CONFIG_PROTOS RELATIVE ${CMAKE_CURRENT_SOURCE_DIR} "bin/*/config.proto")

file(MAKE_DIRECTORY ${project_BUILD_DIR}/config_pb)
jaiabot_protobuf_generate(LANGUAGE CXX
  TARGET_TYPE LIB
  OUT_VAR CONFIG_PROTOS_CPP
  PROTOC_OUT_DIR ${project_BUILD_DIR}/config_pb
  PROTOS ${CONFIG_PROTOS}
)

add_library(jaiabot_config SHARED ${CONFIG_PROTOS_CPP})
target_link_libraries(jaiabot_config protobuf::libprotobuf jaiabot_messages goby goby_zeromq goby_moos)
target_include_directories(jaiabot_config PRIVATE ${project_BUILD_DIR}/config_pb)
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
