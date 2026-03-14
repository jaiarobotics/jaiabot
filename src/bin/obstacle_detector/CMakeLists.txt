set(APP jaiabot_obstacle_detector)

protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${CMAKE_CURRENT_BINARY_DIR} config.proto)

add_executable(${APP}
  app.cpp
  ${PROTO_SRCS} ${PROTO_HDRS})

target_link_libraries(${APP}
  goby
  goby_zeromq
  jaiabot_messages
  OpenCV::OpenCV
  OnnxRuntime::OnnxRuntime
  ByteTrack::ByteTrack)

if(export_goby_interfaces)
  generate_interfaces(${APP})
endif()

project_install_bin(${APP})

install(FILES ${CMAKE_CURRENT_SOURCE_DIR}/best.onnx DESTINATION /var/log/jaiabot/)