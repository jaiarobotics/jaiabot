add_subdirectory(lib)
add_subdirectory(bin)
add_subdirectory(arduino)

if(build_doc)
  find_package(Doxygen REQUIRED dot)
  add_subdirectory(doc)
  
  # doc install
  install(DIRECTORY ${project_BUILD_DIR}/src/doc/html DESTINATION share/doc/jaiabot)
  install(DIRECTORY ${project_BUILD_DIR}/src/doc/figures DESTINATION share/doc/jaiabot)

endif()
