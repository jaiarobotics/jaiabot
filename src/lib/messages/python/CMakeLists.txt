file(CREATE_LINK "../jaiabot" "${CMAKE_CURRENT_SOURCE_DIR}/jaiabot" SYMBOLIC)

jaiabot_protobuf_make_symlinks(LINK
  NANOPB DCCL GOOGLE GOBY)

file(GLOB_RECURSE GOBY_PROTOS
  RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}"
  FOLLOW_SYMLINKS
  "goby/*.proto")

set(PYTHON_PROTOS
  ${JAIABOT_PROTOS}
  nanopb.proto
  dccl/option_extensions.proto
  google/protobuf/descriptor.proto
  ${GOBY_PROTOS})

# Default output dir for normal builds, but allow override from the command line for use by build_messages.sh script
set(PYJAIAPROTOBUF_SRC_OUTDIR
  "${project_SHARE_DIR}/jaiabot/python/pyjaiaprotobuf/src"
  CACHE PATH "Output directory for generated Python protobuf files")

file(MAKE_DIRECTORY "${PYJAIAPROTOBUF_SRC_OUTDIR}")

jaiabot_protobuf_generate(
  LANGUAGE PYTHON
  PROTOC_OUT_DIR "${PYJAIAPROTOBUF_SRC_OUTDIR}"
  PROTOS ${PYTHON_PROTOS}
  OUT_VAR PROTOS_PYTHON)

add_custom_target(pyjaiaprotobuf ALL
  DEPENDS ${PROTOS_PYTHON})
