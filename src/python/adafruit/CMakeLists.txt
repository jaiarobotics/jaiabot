add_jaiabot_python_app(TARGET jaiabot_driver_imu
  SUBDIR adafruit
  INCLUDES jaiabot/messages/imu.pb.h)

# the menu-driven tester that used to be jaiabot_imu.py -i; it drives the driver over the same
# groups any other app would, so it is an application in its own right
add_jaiabot_python_app(TARGET jaiabot_imu_test
  SUBDIR adafruit
  INTERFACE_YML ${CMAKE_CURRENT_SOURCE_DIR}/imu_test_interface.yml
  INCLUDES jaiabot/messages/imu.pb.h)
