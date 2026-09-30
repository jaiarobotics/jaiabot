include(JaiaApp)
include(JaiaLib)

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
add_jaiabot_library(TARGET jaiabot_config
  PROTOS ${CONFIG_PROTOS}
  LINK_LIBRARIES protobuf::libprotobuf jaiabot_messages goby goby_zeromq goby_moos
  PROTOC_OUT_DIR ${project_BUILD_DIR}/config_pb
)

if(build_arduino)
  include(ArduinoCompile)
  add_subdirectory(arduino)
endif()

if(build_stm32)
  include(STM32Compile)
  add_subdirectory(stm32)
endif()

if(build_web)
  add_subdirectory(web)
endif()

if(enable_testing)
  add_subdirectory(test)
endif()
