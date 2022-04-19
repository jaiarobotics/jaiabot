set(APP xbee_driver_tester)

protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${CMAKE_CURRENT_BINARY_DIR} xbee.proto)

add_executable(${APP}
  main.cpp xbee.cpp xbee_driver.cpp driver_tester.cpp
  ${PROTO_SRCS} ${PROTO_HDRS})

add_library(xbee SHARED
    xbee.cpp
    xbee_driver.cpp
    ${PROTO_SRCS} ${PROTO_HDRS})

project_install_lib(xbee)
  
target_link_libraries(${APP}
  goby
  goby_zeromq)

target_link_libraries(xbee
  goby
)



if(export_goby_interfaces)
  generate_interfaces(${APP})
endif()

project_install_bin(${APP})
