# Reads and drives the scripts from the source tree against stubs, so it needs
# no build products
add_test(NAME jaiabot_test_support
  COMMAND ${PYTHON3_EXECUTABLE} -m unittest discover -v -s ${CMAKE_CURRENT_SOURCE_DIR} -p "test_*.py")
