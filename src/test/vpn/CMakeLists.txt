# Runs the scripts from the source tree against stubbed wg tools, so it needs no
# build products
add_test(NAME jaiabot_test_vpn_peers
  COMMAND ${PYTHON3_EXECUTABLE} -m unittest discover -v -s ${CMAKE_CURRENT_SOURCE_DIR} -p "test_*.py")
