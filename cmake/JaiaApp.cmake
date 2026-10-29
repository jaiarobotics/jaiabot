# Add a jaiabot application (binary) to build 
#    - add_executable
#    - protobuf_generate (if necessary)
#    - link libraries
#    - install

# add_jaiabot_application(TARGET target
#                       PROTOS proto1;proto2
#                       SOURCES file1.cpp;file2.cpp
#                       LINK_LIBRARIES target1;target2;${SOME_LIBRARIES}
#                       INCLUDE_DIRECTORIES dir1;dir2)
function(add_jaiabot_application)

    cmake_parse_arguments(
        args # prefix of output variables
        "LINK_DEFAULT_LIBRARIES;SKIP_INSTALL" # list of names of the boolean arguments (only defined ones will be true)
        "TARGET" # list of names of mono-valued arguments
        "PROTOS;SOURCES;LINK_LIBRARIES;INCLUDE_DIRECTORIES" # list of names of multi-valued arguments (output variables are lists)
        ${ARGN} # arguments of the function to parse, here we take the all original ones
    )

    if(NOT args_TARGET)
      message(FATAL_ERROR "You must provide a TARGET")
    endif()
      
    if(NOT args_SOURCES)
      message(FATAL_ERROR "You must provide some SOURCES")
    endif()

    add_executable(${args_TARGET} ${args_SOURCES})

    if(args_PROTOS)
      jaiabot_protobuf_generate(
        LANGUAGE CXX
        OUT_VAR PROTOS_CPP
        TARGET_TYPE BIN
        PROTOS ${args_PROTOS})       
      target_sources(${args_TARGET} PRIVATE ${PROTOS_CPP})
      target_include_directories(${args_TARGET} PRIVATE ${CMAKE_CURRENT_BINARY_DIR})
    endif()
    
    if(args_LINK_DEFAULT_LIBRARIES)
        target_link_libraries(${args_TARGET} goby goby_zeromq jaiabot_messages)
    endif()
    
    if(args_LINK_LIBRARIES)
        target_link_libraries(${args_TARGET} ${args_LINK_LIBRARIES})
    endif()

    if(args_INCLUDE_DIRECTORIES)
        target_include_directories(${args_TARGET} PRIVATE ${args_INCLUDE_DIRECTORIES})
    endif()

    if(export_goby_interfaces)
      generate_interfaces(${args_TARGET})
    endif()

    if(NOT args_SKIP_INSTALL)
      project_install_bin(${args_TARGET})
    endif()
    
endfunction()


