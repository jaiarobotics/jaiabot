# Add a jaiabot library to build 
#    - add_library (SHARED)
#    - protobuf_generate (if necessary)
#    - link libraries
#    - install

# add_jaiabot_library(TARGET target
#                     PROTOS proto1;proto2
#                     PRIVATE_PROTOS proto1;proto2
#                     PROTO_IMPORT_PREFIX prefix/for/protos
#                     SOURCES file1.cpp;file2.cpp
#                     LINK_LIBRARIES target1;target2;${SOME_LIBRARIES}
#                     INCLUDE_DIRECTORIES dir1;dir2
#                     COMPILE_OPTIONS -opt1;-opt2
#                     CXX_STANDARD 17)
function(add_jaiabot_library)

    cmake_parse_arguments(
        args # prefix of output variables
        "SKIP_INSTALL" # list of names of the boolean arguments (only defined ones will be true)
        "TARGET;PROTO_IMPORT_PREFIX;CXX_STANDARD" # list of names of mono-valued arguments
        "PROTOS;PRIVATE_PROTOS;SOURCES;LINK_LIBRARIES;INCLUDE_DIRECTORIES;COMPILE_OPTIONS;IMPORT_DIRS" # list of names of multi-valued arguments (output variables are lists)
        ${ARGN} # arguments of the function to parse, here we take the all original ones
    )

    if(NOT args_TARGET)
      message(FATAL_ERROR "You must provide a TARGET")
    endif()

    add_library(${args_TARGET} SHARED ${args_SOURCES})

    if(args_PROTOS)
      jaiabot_protobuf_generate(
        LANGUAGE CXX
        OUT_VAR PROTOS_CPP
        TARGET_TYPE LIB
        PROTO_IMPORT_PREFIX "${args_PROTO_IMPORT_PREFIX}"
        IMPORT_DIRS ${args_IMPORT_DIRS}
        PROTOS ${args_PROTOS})
      target_sources(${args_TARGET} PRIVATE ${PROTOS_CPP})
    endif()

    if(args_PRIVATE_PROTOS)
      jaiabot_protobuf_generate(
        LANGUAGE CXX
        OUT_VAR PRIVATE_PROTOS_CPP
        TARGET_TYPE BIN
        PROTOS ${args_PRIVATE_PROTOS})
      target_sources(${args_TARGET} PRIVATE ${PRIVATE_PROTOS_CPP})
      target_include_directories(${args_TARGET} PRIVATE ${CMAKE_CURRENT_BINARY_DIR})
    endif()

    if(args_LINK_LIBRARIES)
        target_link_libraries(${args_TARGET} ${args_LINK_LIBRARIES})
    endif()

    if(args_INCLUDE_DIRECTORIES)
        target_include_directories(${args_TARGET} PRIVATE ${args_INCLUDE_DIRECTORIES})
    endif()

    if(args_COMPILE_OPTIONS)
        target_compile_options(${args_TARGET} PRIVATE ${args_COMPILE_OPTIONS})
    endif()

    if(args_CXX_STANDARD)
        set_property(TARGET ${args_TARGET} PROPERTY CXX_STANDARD ${args_CXX_STANDARD})
    endif()

    if(export_goby_interfaces)
      generate_interfaces(${args_TARGET})
    endif()

    if(NOT args_SKIP_INSTALL)
      project_install_lib(${args_TARGET})
    endif()

endfunction()
