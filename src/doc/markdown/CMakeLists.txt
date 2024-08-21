file(GLOB_RECURSE MARKDOWN_FILES RELATIVE ${CMAKE_CURRENT_SOURCE_DIR}
  *.md
  )

foreach(I ${MARKDOWN_FILES})
  configure_file(${CMAKE_CURRENT_SOURCE_DIR}/${I} ${project_BUILD_DIR}/src/doc/markdown/${I} COPYONLY)
endforeach()

file(GLOB_RECURSE PYTHON_MARKDOWN_FILES RELATIVE ${CMAKE_CURRENT_SOURCE_DIR}
  *.py
  )

foreach(PYTHON_MD_GENERATOR ${PYTHON_MARKDOWN_FILES})
  string(REGEX REPLACE "\\.py$" ".md" OUTPUT_MD_FILE "${PYTHON_MD_GENERATOR}")
  set(OUTPUT_FILE ${project_BUILD_DIR}/src/doc/markdown/${OUTPUT_MD_FILE})
  list(APPEND GENERATED_MARKDOWN_FILES "${OUTPUT_FILE}")
  add_custom_command(
    OUTPUT ${project_BUILD_DIR}/src/doc/markdown/${OUTPUT_MD_FILE}
    COMMAND ${CMAKE_COMMAND} -E env "PYTHONPATH=${project_SHARE_DIR}/jaiabot/python/pyjaiaprotobuf" ${project_SCRIPTS_DIR}/jaia-doc.py
    ARGS ${PYTHON_MD_GENERATOR} -o ${OUTPUT_MD_FILE}
    DEPENDS ${PYTHON_MD_GENERATOR} pyjaiaprotobuf
    COMMENT "Running jaia-doc.py to make ${OUTPUT_MD_FILE}"
    )
endforeach()

add_custom_target(generated_markdown
  ALL
  DEPENDS ${GENERATED_MARKDOWN_FILES}
  COMMENT "Generated markdown files"
)
