# Runs jaia-debconf.sh from the source tree against stubbed debconf and systemd
# tools, so it needs no build products
add_test(NAME jaiabot_test_debconf
  COMMAND ${PYTHON3_EXECUTABLE} -m unittest discover -v -s ${CMAKE_CURRENT_SOURCE_DIR} -p "test_*.py")
