# we need to generate a Python version of these external messages as upstream doesn't provide a Python version
file(CREATE_LINK "${NANOPB_PROTO}" "${CMAKE_CURRENT_SOURCE_DIR}/nanopb.proto" SYMBOLIC)
file(CREATE_LINK "${DCCL_INCLUDE_DIR}/dccl/option_extensions.proto" "${CMAKE_CURRENT_SOURCE_DIR}/dccl/option_extensions.proto" SYMBOLIC)
file(CREATE_LINK "${PROTOBUF_INCLUDE_DIRS}/google/protobuf/descriptor.proto" "${CMAKE_CURRENT_SOURCE_DIR}/google/protobuf/descriptor.proto" SYMBOLIC)
file(CREATE_LINK "${GOBY_INCLUDE_DIR}/goby" "${CMAKE_CURRENT_SOURCE_DIR}/goby" SYMBOLIC)

file(GLOB_RECURSE GOBY_PROTOS RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}" FOLLOW_SYMLINKS "goby/*.proto")

set(PYTHON_PROTOS ${JAIABOT_PROTOS}
  nanopb.proto
  dccl/option_extensions.proto
  google/protobuf/descriptor.proto
  ${GOBY_PROTOS})

# Building the JaiaBot Goby message python modules into the pyjaiaprotobuf python package
set(pyjaiaprotobuf_outdir ${project_SHARE_DIR}/jaiabot/python/pyjaiaprotobuf/src)
file(MAKE_DIRECTORY ${pyjaiaprotobuf_outdir})

jaiabot_protobuf_generate(LANGUAGE PYTHON
  PROTOC_OUT_DIR ${pyjaiaprotobuf_outdir}
  PROTOS ${PYTHON_PROTOS}
  OUT_VAR PROTOS_PYTHON)

add_custom_target(pyjaiaprotobuf ALL DEPENDS ${PROTOS_PYTHON})

