file(GLOB FIGURES RELATIVE ${project_SRC_DIR}/doc/figures ${project_SRC_DIR}/doc/figures/*)
foreach(F ${FIGURES})
  configure_file(${project_SRC_DIR}/doc/figures/${F} ${CMAKE_BINARY_DIR}/src/doc/figures/${F} COPYONLY)
endforeach()

configure_file(jaiabot.doxy.in ${CMAKE_BINARY_DIR}/src/doc/jaiabot.doxy @ONLY)

file(GLOB MD_FILES ${project_SRC_DIR}/doc/markdown/*.md)

add_custom_command(
  OUTPUT ${CMAKE_BINARY_DIR}/src/doc/latex/refman.tex ${CMAKE_BINARY_DIR}/src/doc/html/index.html
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/src/doc/markdown
  COMMAND ${DOXYGEN_EXECUTABLE}
  ARGS ${CMAKE_BINARY_DIR}/src/doc/jaiabot.doxy
  DEPENDS ${CMAKE_BINARY_DIR}/src/doc/jaiabot.doxy
  generated_markdown
  ${MD_FILES}
  ${project_goby_interfaces_figures}
  )


add_custom_target(jaiabot_doxygen ALL
  DEPENDS ${CMAKE_BINARY_DIR}/src/doc/html/index.html
  COMMENT "Running doxygen to generate documentation output to ${CMAKE_BINARY_DIR}/src/doc/html/index.html"
  VERBATIM )

option(build_doc_pdf "Build PDF documentation (requires PDFLatex)" OFF)
if(build_doc_pdf)
  find_package(LATEX REQUIRED)
# run pdflatex twice (second pass correctly sets table of contents)
add_custom_command(
  OUTPUT ${CMAKE_BINARY_DIR}/src/doc/latex/refman.pdf
  COMMAND bash -c "for i in 1 2; do echo PDFLatex Run $i; ${PDFLATEX_COMPILER} -file-line-error -halt-on-error refman.tex >& /tmp/jaiabot-doc-pdflatex.log || cat /tmp/jaiabot-doc-pdflatex.log; done"
  DEPENDS ${CMAKE_BINARY_DIR}/src/doc/latex/refman.tex
  WORKING_DIRECTORY ${CMAKE_BINARY_DIR}/src/doc/latex
  VERBATIM )

  add_custom_target(jaiabot_doxygen_pdf ALL
  DEPENDS ${CMAKE_BINARY_DIR}/src/doc/latex/refman.pdf
  COMMENT "Running doxygen to generate PDF documentation output to ${CMAKE_BINARY_DIR}/src/doc/latex/refman.pdf"
  VERBATIM )
endif()
