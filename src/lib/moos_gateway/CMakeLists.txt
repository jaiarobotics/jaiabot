set(LIB jaiabot_moos_gateway_plugin)
add_library(${LIB} SHARED jaiabot_gateway_plugin.cpp)
target_link_libraries(${LIB}
  goby goby_zeromq goby_moos jaiabot_messages)

if(export_goby_interfaces)
  generate_interfaces(${LIB})
endif()

project_install_lib(${LIB})
