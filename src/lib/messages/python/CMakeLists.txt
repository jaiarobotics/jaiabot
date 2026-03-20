file(CREATE_LINK "../jaiabot" "${CMAKE_CURRENT_SOURCE_DIR}/jaiabot" SYMBOLIC)

jaiabot_protobuf_make_symlinks(LINK
  NANOPB DCCL GOOGLE GOBY)

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

