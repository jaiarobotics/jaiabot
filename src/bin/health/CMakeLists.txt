set(APP jaiabot_health)

protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${CMAKE_CURRENT_BINARY_DIR} config.proto)

add_executable(${APP}
  app.cpp
  linux_hardware_thread.cpp
  time_thread.cpp 
  helm_ivp_thread.cpp
  trinket_thread.cpp
  ${PROTO_SRCS} ${PROTO_HDRS})

target_link_libraries(${APP}
  goby
  goby_zeromq
  jaiabot_messages
  boost_filesystem
  )

if(export_goby_interfaces)
  generate_interfaces(${APP})
endif()

project_install_bin(${APP})

# Automatically add any apps built by this project to the name -> enum mapping used by jaiabot_health to parse the goby_coroner health report name strings
foreach(JAIABOT_APP ${PROJECT_APP_LIST})
  string(TOUPPER ${JAIABOT_APP} JAIABOT_APP_UCASE)
  string(APPEND HEALTH_PROCESS_MAP_ENTRIES "MAKE_ENTRY\(${JAIABOT_APP_UCASE}\),")
endforeach()
target_compile_definitions(${APP} PRIVATE JAIABOT_HEALTH_PROCESS_MAP_ENTRIES=${HEALTH_PROCESS_MAP_ENTRIES})

