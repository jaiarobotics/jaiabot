# JaiaStateTool.cmake
#
# CMake integration for jaia_state_tool: a Clang 18 AST-based tool that
# analyzes boost::statechart state machines and generates YAML/DOT/Mermaid diagrams.
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
#       <STATE_DIAGRAM_OUT_DIR>/<target>_states.mmd
#     and (if dot is available) renders the DOT to PDF,
#     and (if mmdc is available) renders the Mermaid diagram to PDF.
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
  message(STATUS "dot (graphviz) not found - Graphviz PDF rendering will be skipped")
endif()

find_program(MMDC_EXECUTABLE mmdc)
if(MMDC_EXECUTABLE)
  message(STATUS "Found mmdc (mermaid-js CLI): ${MMDC_EXECUTABLE}")
else()
  message(STATUS "mmdc (mermaid-js CLI) not found - Mermaid PDF rendering will be skipped")
  message(STATUS "  Install with: npm install -g @mermaid-js/mermaid-cli")
endif()

# ---------------------------------------------------------------------------
# JAIA_GENERATE_STATE_DIAGRAM(TARGET YML_OUT DOT_OUT MMD_OUT)
#   Internal function: adds custom_command to run jaia_state_tool on TARGET.
# ---------------------------------------------------------------------------
function(JAIA_GENERATE_STATE_DIAGRAM TARGET YML_OUT DOT_OUT MMD_OUT)
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
  set(MMD_FILE "${STATE_DIAGRAM_OUT_DIR}/${TARGET}_states.mmd")

  add_custom_command(
    OUTPUT "${YML_FILE}" "${DOT_FILE}" "${MMD_FILE}"
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

  set_source_files_properties("${YML_FILE}" "${DOT_FILE}" "${MMD_FILE}"
    PROPERTIES GENERATED TRUE)

  set(${YML_OUT} "${YML_FILE}" PARENT_SCOPE)
  set(${DOT_OUT} "${DOT_FILE}" PARENT_SCOPE)
  set(${MMD_OUT} "${MMD_FILE}" PARENT_SCOPE)
endfunction()

# ---------------------------------------------------------------------------
# generate_state_diagram(target)
#   Convenience macro: generates YAML + DOT + Mermaid and (if renderers are
#   available) PDF outputs for both Graphviz and Mermaid.
# ---------------------------------------------------------------------------
macro(generate_state_diagram TARGET)
  jaia_generate_state_diagram(${TARGET} _yml_out _dot_out _mmd_out)

  add_custom_target(${TARGET}_state_diagram_files ALL
    DEPENDS "${_yml_out}" "${_dot_out}" "${_mmd_out}")

  set(_render_deps ${TARGET}_state_diagram_files)

  if(DOT_EXECUTABLE)
    set(_dot_pdf_out "${STATE_DIAGRAM_OUT_DIR}/${TARGET}_states_graphviz.pdf")

    add_custom_command(
      OUTPUT "${_dot_pdf_out}"
      COMMAND ${DOT_EXECUTABLE}
      ARGS -Tpdf -o "${_dot_pdf_out}" "${_dot_out}"
      DEPENDS "${_dot_out}"
      COMMENT "Rendering ${TARGET} state diagram to PDF (Graphviz)"
      VERBATIM)

    set_source_files_properties("${_dot_pdf_out}" PROPERTIES GENERATED TRUE)

    add_custom_target(${TARGET}_state_diagram_graphviz ALL
      DEPENDS "${_dot_pdf_out}" ${TARGET}_state_diagram_files)

    list(APPEND _render_deps ${TARGET}_state_diagram_graphviz)
  endif()

  if(MMDC_EXECUTABLE)
    set(_mmd_pdf_out "${STATE_DIAGRAM_OUT_DIR}/${TARGET}_states_mermaid.pdf")

    add_custom_command(
      OUTPUT "${_mmd_pdf_out}"
      COMMAND ${MMDC_EXECUTABLE}
      ARGS -i "${_mmd_out}" -o "${_mmd_pdf_out}"
      DEPENDS "${_mmd_out}"
      COMMENT "Rendering ${TARGET} state diagram to PDF (Mermaid)"
      VERBATIM)

    set_source_files_properties("${_mmd_pdf_out}" PROPERTIES GENERATED TRUE)

    add_custom_target(${TARGET}_state_diagram_mermaid ALL
      DEPENDS "${_mmd_pdf_out}" ${TARGET}_state_diagram_files)

    list(APPEND _render_deps ${TARGET}_state_diagram_mermaid)
  endif()

  add_custom_target(${TARGET}_state_diagram ALL
    DEPENDS ${_render_deps})
endmacro()
