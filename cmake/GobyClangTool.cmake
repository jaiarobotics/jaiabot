# must output json compile commands for goby_clang_tool to work
set(CMAKE_EXPORT_COMPILE_COMMANDS ON CACHE BOOL "Enable/Disable output of compile commands during generation." FORCE)
unset(project_goby_interfaces CACHE)
unset(project_goby_interfaces_figures CACHE)

# usage: goby_export_interface(target_name ${OUTPUT_DIR} YML)
# sets YML to path to yml file
function(GOBY_EXPORT_INTERFACE TARGET YML_OUT_DIR YML)
  get_target_property(TARGET_SOURCES ${TARGET} SOURCES)

  file(MAKE_DIRECTORY ${YML_OUT_DIR})
  
  set(ABS_TARGET_SOURCES)
  foreach(SOURCE ${TARGET_SOURCES})
    get_filename_component(ABS_TARGET_SOURCE ${SOURCE} ABSOLUTE)
    get_filename_component(SOURCE_EXTENSION ${SOURCE} EXT)

    # omit protobuf header files
    if(NOT SOURCE_EXTENSION STREQUAL ".pb.h")
      list(APPEND ABS_TARGET_SOURCES ${ABS_TARGET_SOURCE})
    endif()
  endforeach()  
  
  set(${YML} "${YML_OUT_DIR}/${TARGET}_interface.yml")
  add_custom_command(
    OUTPUT "${YML_OUT_DIR}/${TARGET}_interface.yml"
    COMMAND goby_clang_tool
    ARGS -gen -target ${TARGET} -outdir ${YML_OUT_DIR} -p ${CMAKE_BINARY_DIR} ${ABS_TARGET_SOURCES}
    COMMENT "Running goby_clang_tool on ${TARGET}"
    DEPENDS ${ABS_TARGET_SOURCES} ${TARGET}
    VERBATIM)

  set_source_files_properties(${${YML}} PROPERTIES GENERATED TRUE)
  set(${YML} ${${YML}} PARENT_SCOPE)
endfunction()

# usage: goby_visualize_interfaces(TARGET_OUT YML_DIR DEPLOYMENT_YAML IMAGE_OUT PARAMETERS DEPENDENCY1 DEPENDENCY2 ... )
# generates PDF graphviz graph from deployment yaml file
# TARGET_OUT: store output target name
# YML_DIR: directory to YML interface files
# DEPLOYMENT_YAML: deployment file
# IMAGE_OUT: output image path
# parameters: extra parameters for goby_clang_tool
# DEPENDENCY1..N: YML dependencies (list of targets from GOBY_EXPORT_INTERFACE())
function(GOBY_VISUALIZE_INTERFACES TARGET_OUT YML_DIR DEPLOYMENT_YAML IMAGE_OUT PARAMETERS)

  get_filename_component(ABS_IMAGE_OUT ${IMAGE_OUT} ABSOLUTE)
  get_filename_component(OUT_DIR ${ABS_IMAGE_OUT} DIRECTORY)
  get_filename_component(IMAGE_EXT ${ABS_IMAGE_OUT} EXT)

  # .pdf -> pdf
  string(SUBSTRING ${IMAGE_EXT} 1 -1 IMAGE_TYPE)
  
  get_filename_component(ABS_DEPLOYMENT_YAML ${DEPLOYMENT_YAML} ABSOLUTE)


  if(PARAMETERS)
    string(REGEX REPLACE "[ -=]" "_" PARAMETERS_SUFFIX ${PARAMETERS})
  endif()
  
  file(MAKE_DIRECTORY ${OUT_DIR})
  get_filename_component(DEPLOYMENT_NAME_FROM_FILENAME ${ABS_DEPLOYMENT_YAML} NAME_WE)
  set(DOT_OUT_FILE "${DEPLOYMENT_NAME_FROM_FILENAME}${PARAMETERS_SUFFIX}_${IMAGE_TYPE}.dot")
  set(ABS_DOT_OUT "${OUT_DIR}/${DOT_OUT_FILE}")
  
  add_custom_command(
    OUTPUT ${ABS_DOT_OUT}
    COMMAND goby_clang_tool
    ARGS -viz -outdir ${OUT_DIR} -o ${DOT_OUT_FILE} -p ${CMAKE_BINARY_DIR} ${ABS_DEPLOYMENT_YAML} ${PARAMETERS}
    DEPENDS ${ARGN} ${ABS_DEPLOYMENT_YAML}
    WORKING_DIRECTORY ${YML_DIR}
    )

  set_source_files_properties(${ABS_DOT_OUT} PROPERTIES GENERATED TRUE)
  
  add_custom_command(
    OUTPUT ${ABS_IMAGE_OUT}
    COMMAND dot
    ARGS -T${IMAGE_TYPE} -o ${ABS_IMAGE_OUT} ${ABS_DOT_OUT}  
    DEPENDS ${ABS_DOT_OUT}
    )

  set_source_files_properties(${ABS_IMAGE_OUT} PROPERTIES GENERATED TRUE)

  set(LOCAL_TARGET_OUT ${DEPLOYMENT_NAME_FROM_FILENAME}${PARAMETERS_SUFFIX}_interface_viz_${IMAGE_TYPE})
  add_custom_target(${LOCAL_TARGET_OUT} ALL DEPENDS ${ABS_IMAGE_OUT})
  set(${TARGET_OUT} ${LOCAL_TARGET_OUT} PARENT_SCOPE)
endfunction()


macro(generate_interfaces target) 
  goby_export_interface(${target} ${YML_OUT_DIR} ${target}_YML_OUT)
  add_custom_target(${target}_interface ALL DEPENDS ${${target}_YML_OUT})
  set(project_goby_interfaces "${project_goby_interfaces};${target}_interface;${target}" CACHE INTERNAL "Goby Interface YMLS")
endmacro()
    
macro(generate_interfaces_figure INTERFACE_YML YML_OUT_DIR OUTPUT_IMAGE PARAMETERS) 
  get_filename_component(INTERFACE_YML_NAME_WE ${INTERFACE_YML} NAME_WE)
  set(CONFIGURED_INTERFACE_YML ${YML_OUT_DIR}/figures/${INTERFACE_YML_NAME_WE}.yml)
  configure_file(${INTERFACE_YML} ${CONFIGURED_INTERFACE_YML} @ONLY)
  goby_visualize_interfaces(TARGET_OUT ${YML_OUT_DIR} ${CONFIGURED_INTERFACE_YML} ${YML_OUT_DIR}/figures/${OUTPUT_IMAGE} "${PARAMETERS}" ${project_goby_interfaces})
  set(project_goby_interfaces_figures "${project_goby_interfaces_figures};${TARGET_OUT}" CACHE INTERNAL "Goby Interface Figures")
endmacro()
