# ####
# #Nanopb
# ###
configure_file(${NANOPB_PROTO} ${CMAKE_CURRENT_SOURCE_DIR}/nanopb.proto COPYONLY)

# we need to generate a nanopb version of these external messages as upstream doesn't provide a nanopb version
configure_file(${DCCL_INCLUDE_DIR}/dccl/option_extensions.proto ${CMAKE_CURRENT_SOURCE_DIR}//dccl/option_extensions.proto COPYONLY)
configure_file(${PROTOBUF_INCLUDE_DIRS}/google/protobuf/descriptor.proto ${CMAKE_CURRENT_SOURCE_DIR}/google/protobuf/descriptor.proto COPYONLY)

jaiabot_protobuf_generate(LANGUAGE C
  PROTO_IMPORT_PREFIX "google/protobuf"
  TARGET_TYPE LIB
  PROTOC_OUT_DIR ${project_INC_DIR}/nanopb
  OUT_VAR GOOGLE_PROTOS_C
  PROTOS descriptor.proto
) 

jaiabot_protobuf_generate(LANGUAGE C
  PROTO_IMPORT_PREFIX "dccl"
  TARGET_TYPE LIB
  PROTOC_OUT_DIR ${project_INC_DIR}/nanopb
  OUT_VAR DCCL_PROTOS_C
  PROTOS option_extensions.proto
) 

jaiabot_protobuf_generate(LANGUAGE C
  PROTO_IMPORT_PREFIX "jaiabot/messages"
  TARGET_TYPE LIB
  PROTOC_OUT_DIR ${project_INC_DIR}/nanopb
  OUT_VAR PROTOS_C
  PROTOS
  arduino.proto
  feather.proto
  ${SENSOR_MESSAGES}
)

add_library(jaiabot_messages_c SHARED
  ${GOOGLE_PROTOS_C}
  ${DCCL_PROTOS_C}
  ${PROTOS_C}
)

target_link_libraries(jaiabot_messages_c nanopb::protobuf-nanopb-static)

# make sure we don't accidentally include C++ headers for generated protobufs when compiling with C by clearing and re-adding only desired include directories in the correct order (so nanopb generated headers come before others)
set_target_properties(jaiabot_messages_c PROPERTIES INCLUDE_DIRECTORIES "")
target_include_directories(jaiabot_messages_c
    PRIVATE ${project_INC_DIR}/nanopb
    PRIVATE ${project_INC_DIR}
)

project_install_lib(jaiabot_messages_c)


