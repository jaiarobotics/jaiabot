find_package(Protobuf REQUIRED)

# jaiabot_protobuf_generate(PROTOS proto1;proto2
#                           LANGUAGE CXX|C|PYTHON
#                           OUT_VAR PROTOS_CPP
#                           PROTOC_OUT_DIR /path/to/output/directory
#                           IMPORT_DIRS /path/to/import/dir)
function(jaiabot_protobuf_generate)

  cmake_parse_arguments(
    args # prefix of output variables
    "" # list of names of the boolean arguments (only defined ones will be true)
    "OUT_VAR;TARGET_TYPE;PROTOC_OUT_DIR;LANGUAGE" # list of names of mono-valued arguments
    "PROTOS;IMPORT_DIRS" # list of names of multi-valued arguments (output variables are lists)
    ${ARGN} # arguments of the function to parse, here we take the all original ones
  )

  if(NOT args_LANGUAGE)
    message(FATAL_ERROR "No LANGUAGE given to jaiabot_protobuf_generate - you need at least one")
  endif()  

  if(args_PROTOC_OUT_DIR)
    set(protoc_out_dir ${args_PROTOC_OUT_DIR})
  elseif("${args_TARGET_TYPE}" STREQUAL "LIB")
    set(protoc_out_dir ${project_INC_DIR})
  elseif("${args_TARGET_TYPE}" STREQUAL "BIN")
    set(protoc_out_dir ${CMAKE_CURRENT_BINARY_DIR})    
  else()
    message(FATAL_ERROR "You must define PROTOC_OUT_DIR or set TARGET_TYPE LIB|BIN for jaiabot_protobuf_generate")
  endif()

  set(project_PROTO_IMPORT_DIRS "${protoc_out_dir};${project_INC_DIR};${GOBY_INCLUDE_DIR};${DCCL_INCLUDE_DIR}")

  
  if("${args_LANGUAGE}" STREQUAL "CXX")
    protobuf_generate(
      LANGUAGE dccl
      PROTOC_OPTIONS --cpp_out=${protoc_out_dir}
      OUT_VAR ${args_OUT_VAR}
      PROTOC_OUT_DIR ${protoc_out_dir}
      IMPORT_DIRS ${project_PROTO_IMPORT_DIRS} ${args_IMPORT_DIRS}
      PROTOS ${args_PROTOS}
      GENERATE_EXTENSIONS .pb.h .pb.cc
    )
  elseif("${args_LANGUAGE}" STREQUAL "C")
    protobuf_generate(
      LANGUAGE nanopb
      OUT_VAR ${args_OUT_VAR}
      PROTOC_OUT_DIR ${protoc_out_dir}
      IMPORT_DIRS ${project_PROTO_IMPORT_DIRS} ${args_IMPORT_DIRS}
      PROTOS ${args_PROTOS}
      GENERATE_EXTENSIONS .pb.h .pb.c
    )
  elseif("${args_LANGUAGE}" STREQUAL "PYTHON")
    protobuf_generate(
      LANGUAGE python
      PROTOC_OPTIONS --pyi_out=${protoc_out_dir}
      OUT_VAR ${args_OUT_VAR}
      PROTOC_OUT_DIR ${protoc_out_dir}
      IMPORT_DIRS ${project_PROTO_IMPORT_DIRS} ${args_IMPORT_DIRS}
      PROTOS ${args_PROTOS}
    )
  else()
    message(FATAL_ERROR "Unsupported LANGUAGE ${args_LANGUAGE} given to jaiabot_protobuf_generate")
  endif()

  set(${args_OUT_VAR} ${${args_OUT_VAR}} PARENT_SCOPE)
endfunction()

# Builds symlinks required by protoc for external projects protos
#
# jaiabot_protobuf_make_symlinks(LINK GOOGLE|NANOPB|DCCL|GOBY)
function(jaiabot_protobuf_make_symlinks)
  cmake_parse_arguments(
    args # prefix of output variables
    "" # list of names of the boolean arguments (only defined ones will be true)
    "" # list of names of mono-valued arguments
    "LINK" # list of names of multi-valued arguments (output variables are lists)
    ${ARGN} # arguments of the function to parse, here we take the all original ones
  )
  foreach(lnk ${args_LINK})
    if("${lnk}" STREQUAL "NANOPB")
      set(NANOPB_PROTO /usr/lib/python3/dist-packages/proto/nanopb.proto)
      file(CREATE_LINK "${NANOPB_PROTO}" "${CMAKE_CURRENT_SOURCE_DIR}/nanopb.proto" SYMBOLIC)
      # the sensor messages shared with the payload board MCU import nanopb.proto, so any
      # application importing them needs protoc to resolve it from the shared include dir too
      file(MAKE_DIRECTORY "${project_INC_DIR}")
      file(CREATE_LINK "${NANOPB_PROTO}" "${project_INC_DIR}/nanopb.proto" SYMBOLIC)
    elseif("${lnk}" STREQUAL "DCCL")
      file(CREATE_LINK "${DCCL_INCLUDE_DIR}/dccl" "${CMAKE_CURRENT_SOURCE_DIR}/dccl" SYMBOLIC)
    elseif("${lnk}" STREQUAL "GOOGLE")
      # Determine a single protobuf include directory before appending "/google".
      if(PROTOBUF_INCLUDE_DIR)
        set(_protobuf_include_dir "${PROTOBUF_INCLUDE_DIR}")
      elseif(Protobuf_INCLUDE_DIR)
        set(_protobuf_include_dir "${Protobuf_INCLUDE_DIR}")
      elseif(PROTOBUF_INCLUDE_DIRS)
        list(GET PROTOBUF_INCLUDE_DIRS 0 _protobuf_include_dir)
      else()
        message(FATAL_ERROR "No protobuf include directory variable found for GOOGLE symlink")
      endif()
      file(CREATE_LINK "${_protobuf_include_dir}/google" "${CMAKE_CURRENT_SOURCE_DIR}/google" SYMBOLIC)
    elseif("${lnk}" STREQUAL "GOBY")     
      file(CREATE_LINK "${GOBY_INCLUDE_DIR}/goby" "${CMAKE_CURRENT_SOURCE_DIR}/goby" SYMBOLIC)
    else()
      message(FATAL_ERROR "Unknown LINK ${lnk} passed to jaiabot_protobuf_make_symlinks")
    endif()    
  endforeach()
endfunction()

