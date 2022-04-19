add_subdirectory(lib)
add_subdirectory(bin)

if(build_doc)
  find_package(Doxygen REQUIRED dot)
  add_subdirectory(doc)
  
  # doc install
  install(DIRECTORY ${project_BUILD_DIR}/src/doc/html DESTINATION share/doc/jaiabot)
  install(DIRECTORY ${project_BUILD_DIR}/src/doc/figures DESTINATION share/doc/jaiabot)

endif()


file(GLOB_RECURSE PYTHON_FILES RELATIVE ${project_SRC_DIR}/python
  *.py
  )

foreach(P ${PYTHON_FILES})
  configure_file(${project_SRC_DIR}/python/${P} ${project_BIN_DIR}/jaia_py/${P} COPYONLY)
endforeach()

install(DIRECTORY ${project_BIN_DIR}/jaia_py DESTINATION bin USE_SOURCE_PERMISSIONS FILES_MATCHING PATTERN *.py)
