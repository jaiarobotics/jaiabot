file(MAKE_DIRECTORY ${project_TEST_DIR}/util/resources)
file(COPY rsync_output.log DESTINATION ${project_TEST_DIR}/util/resources)

add_executable(jaiabot_test_util test.cpp)
add_test(NAME jaiabot_test_util COMMAND jaiabot_test_util)

target_link_libraries(jaiabot_test_util
  jaiabot_util
)


