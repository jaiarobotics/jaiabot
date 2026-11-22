add_test(NAME jaiabot_test_h5
  COMMAND ${PYTHON3_EXECUTABLE} -m unittest discover -v -s ${CMAKE_CURRENT_SOURCE_DIR} -p "test_*.py")
