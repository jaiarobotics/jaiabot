set(APP jaiabot_simulator)

protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${CMAKE_CURRENT_BINARY_DIR} config.proto)

add_executable(${APP}
  simulator.cpp
  arduino_sim_thread.cpp
  gps_sim_thread.cpp
  oceanographic_sim_thread.cpp
  ezo_ec_sim_thread.cpp
  bar30_sim_thread.cpp
  hub_sim_thread.cpp
  storm_sim_thread.cpp
  imu_sim_thread.cpp
  dive_sim_thread.cpp
  ${PROTO_SRCS} ${PROTO_HDRS})

target_link_libraries(${APP}
  goby
  goby_zeromq
  goby_moos
  jaiabot_messages)

if(export_goby_interfaces)
  generate_interfaces(${APP})
endif()

project_install_bin(${APP})
