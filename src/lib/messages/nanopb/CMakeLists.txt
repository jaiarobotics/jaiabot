file(CREATE_LINK "../jaiabot" "${CMAKE_CURRENT_SOURCE_DIR}/jaiabot" SYMBOLIC)

jaiabot_protobuf_make_symlinks(LINK
  NANOPB DCCL GOOGLE)

# we don't actually build the nanopb.proto here, just needed by protoc
set(C_PROTOS ${MCU_PROTOS}
  google/protobuf/descriptor.proto
  dccl/option_extensions.proto)

add_jaiabot_library(TARGET jaiabot_messages_c
  PROTOS ${C_PROTOS}
  PROTOC_OUT_DIR ${project_INC_DIR}/nanopb
  LANGUAGE C
  LINK_LIBRARIES nanopb::protobuf-nanopb-static)

# make sure we don't accidentally include C++ headers for generated protobufs when compiling with C (as they both use extension ".pb.h") by clearing and re-adding only desired include directories in the correct order (so nanopb generated headers come before others)
set_target_properties(jaiabot_messages_c PROPERTIES INCLUDE_DIRECTORIES "")
target_include_directories(jaiabot_messages_c
    PRIVATE ${project_INC_DIR}/nanopb
    PRIVATE ${project_INC_DIR}
)

