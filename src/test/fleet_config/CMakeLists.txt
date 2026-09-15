# Runs protoc on the source tree itself, so it needs no build products
add_test(NAME jaiabot_test_fleet_config
  COMMAND ${PYTHON3_EXECUTABLE} -m unittest discover -v -s ${CMAKE_CURRENT_SOURCE_DIR} -p "test_*.py")
