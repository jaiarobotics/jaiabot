find_package(Protobuf REQUIRED)

# jaiabot_protobuf_generate(PROTOS proto1;proto2
#                           LANGUAGE CPP|CXX|C++|C
#                           OUT_VAR PROTOS_CPP
#                           IMPORT_DIRS /path/to/import/dir)
function(jaiabot_protobuf_generate)

  cmake_parse_arguments(
    args # prefix of output variables
    "" # list of names of the boolean arguments (only defined ones will be true)
    "OUT_VAR;PROTO_IMPORT_PREFIX;TARGET_TYPE" # list of names of mono-valued arguments
    "PROTOS;LANGUAGE;IMPORT_DIRS" # list of names of multi-valued arguments (output variables are lists)
    ${ARGN} # arguments of the function to parse, here we take the all original ones
  )

  if(NOT args_LANGUAGE)
    message(FATAL_ERROR "No LANGUAGE given to jaiabot_protobuf_generate - you need at least one")
  endif()
  
  # Create the symlink required by Protobuf to correctly generate the prefix needed
  # That is, if we give PROTO_IMPORT_PREFIX = jaiabot/messages
  # we need to generate symlink ${CMAKE_CURRENT_SOURCE_DIR}/jaiabot/messages -> ..
  # Also, add it to the .gitignore if not already done
  #
  # This whole business is necessary due to the way that protoc embeds the package name in the
  # generated code
  if(args_PROTO_IMPORT_PREFIX)
    if(NOT EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/${args_PROTO_IMPORT_PREFIX}")
      get_filename_component(_proto_parent   "${args_PROTO_IMPORT_PREFIX}" DIRECTORY) 
      get_filename_component(_proto_basename "${args_PROTO_IMPORT_PREFIX}" NAME)     
      
      string(REPLACE "/" ";" _proto_parent_list "${_proto_parent}")
      list(LENGTH _proto_parent_list _proto_depth)
      
      set(_rel_up "")
      foreach(_i RANGE 1 ${_proto_depth})
        set(_rel_up "${_rel_up}../")
      endforeach()
      
      file(MAKE_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/${_proto_parent}")
      
      file(CREATE_LINK
        "${_rel_up}"   
        "${CMAKE_CURRENT_SOURCE_DIR}/${_proto_parent}/${_proto_basename}"
        SYMBOLIC
      )
      
    endif()
    set(GITIGNORE_FILE "${CMAKE_CURRENT_SOURCE_DIR}/.gitignore")
    set(ENTRY "${args_PROTO_IMPORT_PREFIX}")
    if(NOT EXISTS "${GITIGNORE_FILE}")
      file(WRITE "${GITIGNORE_FILE}" "")
    endif()  
    file(READ "${GITIGNORE_FILE}" GITIGNORE_CONTENTS)  
    string(FIND "${GITIGNORE_CONTENTS}" "${ENTRY}" ENTRY_POS)
    if(ENTRY_POS EQUAL -1)
      file(APPEND "${GITIGNORE_FILE}" "\n${ENTRY}\n")
    endif()
    # End create symlink
    
    list(TRANSFORM args_PROTOS PREPEND "${args_PROTO_IMPORT_PREFIX}/")
  endif()
  
  set(project_PROTO_IMPORT_DIRS "${project_INC_DIR};${GOBY_INCLUDE_DIR};${DCCL_INCLUDE_DIR}")

  if("${args_TARGET_TYPE}" STREQUAL "LIB")
    set(protoc_out_dir ${project_INC_DIR})
  elseif("${args_TARGET_TYPE}" STREQUAL "BIN")
    set(protoc_out_dir ${CMAKE_CURRENT_BINARY_DIR})    
  else()
    message(FATAL_ERROR "Unsupported TARGET_TYPE ${args_TARGET_TYPE} given to jaiabot_protobuf_generate")

  endif()
    
  foreach(language ${args_LANGUAGE})
    if("${language}" STREQUAL "CPP" OR "${language}" STREQUAL "CXX" OR "${language}" STREQUAL "C++")
      protobuf_generate(
        LANGUAGE dccl
        PROTOC_OPTIONS --cpp_out=${protoc_out_dir}
        OUT_VAR ${args_OUT_VAR}
        PROTOC_OUT_DIR ${protoc_out_dir}
        IMPORT_DIRS ${project_PROTO_IMPORT_DIRS} ${args_IMPORT_DIRS}
        PROTOS ${args_PROTOS}
        GENERATE_EXTENSIONS .pb.h .pb.cc
      )
    elseif("${language}" STREQUAL "C")
      protobuf_generate(
        LANGUAGE nanopb
        OUT_VAR ${args_OUT_VAR}
        PROTOC_OUT_DIR ${protoc_out_dir}
        IMPORT_DIRS ${project_PROTO_IMPORT_DIRS} ${args_IMPORT_DIRS}
        PROTOS ${args_PROTOS}
        GENERATE_EXTENSIONS .pb.h .pb.c
      )
    else()
      message(FATAL_ERROR "Unsupported LANGUAGE ${language} given to jaiabot_protobuf_generate")
    endif()
  endforeach()

  set(${args_OUT_VAR} ${${args_OUT_VAR}} PARENT_SCOPE)
endfunction()
