jaiabot_protobuf_generate(LANGUAGE CXX
  TARGET_TYPE BIN
  OUT_VAR PROTOS_CPP
  PROTOS config.proto)

add_library(jaiabot_liaison SHARED jaiabot_liaison_load.cpp liaison_jaiabot.cpp ${PROTOS_CPP})
target_link_libraries(jaiabot_liaison goby goby_zeromq ${Boost_LIBRARIES} jaiabot_messages  Wt::Wt)
target_include_directories(jaiabot_liaison PRIVATE ${CMAKE_CURRENT_BINARY_DIR})
target_compile_options(jaiabot_liaison PRIVATE -Wno-return-type-c-linkage)

if(export_goby_interfaces)
  generate_interfaces(jaiabot_liaison)
endif()

project_install_lib(jaiabot_liaison)

set_property(TARGET jaiabot_liaison PROPERTY CXX_STANDARD 17)
