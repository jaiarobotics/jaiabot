# Reads the configure script in the source tree, so it needs no build products
add_test(NAME jaiabot_test_cloudhub
  COMMAND ${PYTHON3_EXECUTABLE} -m unittest discover -v -s ${CMAKE_CURRENT_SOURCE_DIR} -p "test_*.py")
