# ####
# #Nanopb
# ###
file(CREATE_LINK "${NANOPB_PROTO}" "${CMAKE_CURRENT_SOURCE_DIR}/nanopb.proto" SYMBOLIC)

# we need to generate a nanopb version of these external messages as upstream doesn't provide a nanopb version
file(CREATE_LINK "${DCCL_INCLUDE_DIR}/dccl/option_extensions.proto" "${CMAKE_CURRENT_SOURCE_DIR}/dccl/option_extensions.proto" SYMBOLIC)
file(CREATE_LINK "${PROTOBUF_INCLUDE_DIRS}/google/protobuf/descriptor.proto" "${CMAKE_CURRENT_SOURCE_DIR}/google/protobuf/descriptor.proto" SYMBOLIC)


jaiabot_protobuf_generate(LANGUAGE C
  TARGET_TYPE LIB
  PROTOC_OUT_DIR ${project_INC_DIR}/nanopb
  OUT_VAR GOOGLE_PROTOS_C
  PROTOS google/protobuf/descriptor.proto
) 

jaiabot_protobuf_generate(LANGUAGE C
  TARGET_TYPE LIB
  PROTOC_OUT_DIR ${project_INC_DIR}/nanopb
  OUT_VAR DCCL_PROTOS_C
  PROTOS dccl/option_extensions.proto
) 

jaiabot_protobuf_generate(LANGUAGE C
  TARGET_TYPE LIB
  PROTOC_OUT_DIR ${project_INC_DIR}/nanopb
  OUT_VAR PROTOS_C
  PROTOS ${MCU_PROTOS}
)

add_jaiabot_library(TARGET jaiabot_messages_c
  SOURCES ${GOOGLE_PROTOS_C} ${DCCL_PROTOS_C} ${PROTOS_C}
  LINK_LIBRARIES nanopb::protobuf-nanopb-static)

#set(C_PROTOS 
#  google/protobuf/descriptor.proto
#  nanopb.proto
#  dccl/option_extensions.proto
#  ${MCU_PROTOS}
#  )

#message("${C_PROTOS}")

#add_jaiabot_library(TARGET jaiabot_messages_c
#  LANGUAGE C
#  PROTOS ${C_PROTOS}
#  PROTOC_OUT_DIR ${project_INC_DIR}/nanopb
#  LINK_LIBRARIES nanopb::protobuf-nanopb-static)

# make sure we don't accidentally include C++ headers for generated protobufs when compiling with C by clearing and re-adding only desired include directories in the correct order (so nanopb generated headers come before others)
set_target_properties(jaiabot_messages_c PROPERTIES INCLUDE_DIRECTORIES "")
target_include_directories(jaiabot_messages_c
    PRIVATE ${project_INC_DIR}/nanopb
    PRIVATE ${project_INC_DIR}
)

