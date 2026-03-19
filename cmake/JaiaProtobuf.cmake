find_package(Protobuf REQUIRED)

# jaiabot_protobuf_generate(PROTOS proto1;proto2
#                           LANGUAGE CPP|CXX|C++|C
#                           OUT_VAR PROTOS_CPP
#                           IMPORT_DIRS /path/to/import/dir)
function(jaiabot_protobuf_generate)

  cmake_parse_arguments(
    args # prefix of output variables
    "" # list of names of the boolean arguments (only defined ones will be true)
    "OUT_VAR;PROTO_IMPORT_PREFIX;TARGET_TYPE;PROTOC_OUT_DIR" # list of names of mono-valued arguments
    "PROTOS;LANGUAGE;IMPORT_DIRS" # list of names of multi-valued arguments (output variables are lists)
    ${ARGN} # arguments of the function to parse, here we take the all original ones
  )

  if(NOT args_LANGUAGE)
    message(FATAL_ERROR "No LANGUAGE given to jaiabot_protobuf_generate - you need at least one")
  endif()
  
  if(args_PROTO_IMPORT_PREFIX)    
    list(TRANSFORM args_PROTOS PREPEND "${args_PROTO_IMPORT_PREFIX}/")
  endif()
  

  if(args_PROTOC_OUT_DIR)
    set(protoc_out_dir ${args_PROTOC_OUT_DIR})
  elseif("${args_TARGET_TYPE}" STREQUAL "LIB")
    set(protoc_out_dir ${project_INC_DIR})
  elseif("${args_TARGET_TYPE}" STREQUAL "BIN")
    set(protoc_out_dir ${CMAKE_CURRENT_BINARY_DIR})    
  else()
    message(FATAL_ERROR "Unsupported TARGET_TYPE ${args_TARGET_TYPE} given to jaiabot_protobuf_generate")
  endif()

  set(project_PROTO_IMPORT_DIRS "${protoc_out_dir};${project_INC_DIR};${GOBY_INCLUDE_DIR};${DCCL_INCLUDE_DIR}")

  
  foreach(language ${args_LANGUAGE})
    if("${language}" STREQUAL "CPP" OR "${language}" STREQUAL "CXX" OR "${language}" STREQUAL "C++")
      protobuf_generate(
        LANGUAGE dccl
        PROTOC_OPTIONS --cpp_out=${protoc_out_dir}
        OUT_VAR ${args_OUT_VAR}
        PROTOC_OUT_DIR ${protoc_out_dir}
        IMPORT_DIRS ${project_PROTO_IMPORT_DIRS}
        PROTOS ${args_PROTOS}
        GENERATE_EXTENSIONS .pb.h .pb.cc
      )
    elseif("${language}" STREQUAL "C")
      protobuf_generate(
        LANGUAGE nanopb
        OUT_VAR ${args_OUT_VAR}
        PROTOC_OUT_DIR ${protoc_out_dir}
        IMPORT_DIRS ${project_PROTO_IMPORT_DIRS}
        PROTOS ${args_PROTOS}
        GENERATE_EXTENSIONS .pb.h .pb.c
      )
    else()
      message(FATAL_ERROR "Unsupported LANGUAGE ${language} given to jaiabot_protobuf_generate")
    endif()
  endforeach()

  set(${args_OUT_VAR} ${${args_OUT_VAR}} PARENT_SCOPE)
endfunction()
