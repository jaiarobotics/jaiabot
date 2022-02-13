set(APP xbee_driver_tester)

add_executable(${APP}
  main.cpp xbee.cpp xbee_driver.cpp driver_tester.cpp
  ${PROTO_SRCS} ${PROTO_HDRS})

add_library(xbee SHARED
    xbee.cpp
    xbee_driver.cpp
)

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
