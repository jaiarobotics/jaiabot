add_jaiabot_application(TARGET jaiabot_comms_manager
  PROTOS config.proto
  SOURCES comms_manager.cpp
  LINK_DEFAULT_LIBRARIES)
