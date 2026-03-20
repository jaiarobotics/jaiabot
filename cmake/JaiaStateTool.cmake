# JaiaStateTool.cmake
#
# CMake integration for jaia_state_tool: a Clang 18 AST-based tool that
# analyzes boost::statechart state machines and generates YAML/DOT diagrams.
#
# Usage in a target's CMakeLists.txt:
#   if(build_state_diagrams)
#     generate_state_diagram(${APP})
#   endif()
#
# Macros:
#   generate_state_diagram(target)
#     Runs jaia_state_tool on the sources of <target> to produce:
#       <STATE_DIAGRAM_OUT_DIR>/<target>_states.yml
#       <STATE_DIAGRAM_OUT_DIR>/<target>_states.dot
#     and (if dot is available) renders the DOT to SVG.
#
# Required variables (set before including this module):
#   STATE_DIAGRAM_OUT_DIR  - directory to write output files into

# jaia_state_tool needs a compile_commands.json
set(CMAKE_EXPORT_COMPILE_COMMANDS ON
  CACHE BOOL "Enable/Disable output of compile commands during generation." FORCE)

find_program(DOT_EXECUTABLE dot)
if(DOT_EXECUTABLE)
  message(STATUS "Found dot (graphviz): ${DOT_EXECUTABLE}")
else()
  message(STATUS "dot (graphviz) not found - SVG rendering will be skipped")
endif()

# ---------------------------------------------------------------------------
# JAIA_GENERATE_STATE_DIAGRAM(TARGET YML_OUT DOT_OUT)
#   Internal function: adds custom_command to run jaia_state_tool on TARGET.
# ---------------------------------------------------------------------------
function(JAIA_GENERATE_STATE_DIAGRAM TARGET YML_OUT DOT_OUT)
  get_target_property(TARGET_SOURCES ${TARGET} SOURCES)

  # Build absolute source list; skip protobuf-generated headers
  set(ABS_SOURCES)
  foreach(SRC ${TARGET_SOURCES})
    get_filename_component(ABS_SRC ${SRC} ABSOLUTE)
    get_filename_component(SRC_EXT ${SRC} EXT)
    if(NOT SRC_EXT STREQUAL ".pb.h")
      list(APPEND ABS_SOURCES ${ABS_SRC})
    endif()
  endforeach()

  file(MAKE_DIRECTORY ${STATE_DIAGRAM_OUT_DIR})

  set(YML_FILE "${STATE_DIAGRAM_OUT_DIR}/${TARGET}_states.yml")
  set(DOT_FILE "${STATE_DIAGRAM_OUT_DIR}/${TARGET}_states.dot")

  add_custom_command(
    OUTPUT "${YML_FILE}" "${DOT_FILE}"
    COMMAND $<TARGET_FILE:jaia_state_tool>
    ARGS -gen
         -target ${TARGET}
         -outdir ${STATE_DIAGRAM_OUT_DIR}
         -p ${CMAKE_BINARY_DIR}
         ${ABS_SOURCES}
         --extra-arg=-Wno-return-type-c-linkage
    COMMENT "Running jaia_state_tool on ${TARGET}"
    DEPENDS ${ABS_SOURCES} ${TARGET} jaia_state_tool
    VERBATIM)

  set_source_files_properties("${YML_FILE}" "${DOT_FILE}" PROPERTIES GENERATED TRUE)

  set(${YML_OUT} "${YML_FILE}" PARENT_SCOPE)
  set(${DOT_OUT} "${DOT_FILE}" PARENT_SCOPE)
endfunction()

# ---------------------------------------------------------------------------
# generate_state_diagram(target)
#   Convenience macro: generates YAML + DOT and (if dot is available) SVG.
# ---------------------------------------------------------------------------
macro(generate_state_diagram TARGET)
  jaia_generate_state_diagram(${TARGET} _yml_out _dot_out)

  add_custom_target(${TARGET}_state_diagram_files ALL
    DEPENDS "${_yml_out}" "${_dot_out}")

  if(DOT_EXECUTABLE)
    set(_svg_out "${STATE_DIAGRAM_OUT_DIR}/${TARGET}_states.svg")

    add_custom_command(
      OUTPUT "${_svg_out}"
      COMMAND ${DOT_EXECUTABLE}
      ARGS -Tsvg -o "${_svg_out}" "${_dot_out}"
      DEPENDS "${_dot_out}"
      COMMENT "Rendering ${TARGET} state diagram to SVG"
      VERBATIM)

    set_source_files_properties("${_svg_out}" PROPERTIES GENERATED TRUE)

    add_custom_target(${TARGET}_state_diagram ALL
      DEPENDS "${_svg_out}" ${TARGET}_state_diagram_files)
  else()
    add_custom_target(${TARGET}_state_diagram ALL
      DEPENDS ${TARGET}_state_diagram_files)
  endif()
endmacro()
