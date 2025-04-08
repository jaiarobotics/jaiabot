set(APP jaiabot_sensors)

protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${CMAKE_CURRENT_BINARY_DIR} config.proto)

add_executable(${APP}
  app.cpp
  drivers/atlas_scientific__oem_ec.cpp
  drivers/atlas_scientific__oem_do.cpp
  drivers/atlas_scientific__oem_ph.cpp
  drivers/blue_robotics_bar30.cpp
  drivers/turner__c_fluor.cpp
  ${PROTO_SRCS} ${PROTO_HDRS})

target_link_libraries(${APP}
  goby
  goby_zeromq
  jaiabot_messages)

if(export_goby_interfaces)
  generate_interfaces(${APP})
endif()

project_install_bin(${APP})
