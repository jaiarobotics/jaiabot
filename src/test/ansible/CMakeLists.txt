# Reads the playbooks in the source tree, so it needs no build products
add_test(NAME jaiabot_test_ansible_shell_quotes
  COMMAND ${PYTHON3_EXECUTABLE} -m unittest discover -v -s ${CMAKE_CURRENT_SOURCE_DIR} -p "test_*.py")
