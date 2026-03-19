add_jaiabot_application(TARGET jaiabot_driver_arduino
  PROTOS config.proto
  SOURCES app.cpp
  LINK_DEFAULT_LIBRARIES
  LINK_LIBRARIES jaiabot_messages_c)

