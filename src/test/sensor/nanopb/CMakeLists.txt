add_executable(jaiabot_test_sensor_nanopb test.c)
set_target_properties(jaiabot_test_sensor_nanopb PROPERTIES INCLUDE_DIRECTORIES "")
target_include_directories(jaiabot_test_sensor_nanopb
    PRIVATE ${project_INC_DIR}/nanopb
    )
  
target_link_libraries(jaiabot_test_sensor_nanopb jaiabot_messages_c)

# add_test(NAME jaiabot_test_sensor_nanopb COMMAND jaiabot_test_comms_nanopb)
