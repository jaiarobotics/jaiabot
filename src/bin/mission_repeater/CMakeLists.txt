add_jaiabot_application(TARGET jaiabot_mission_repeater
  PROTOS config.proto
  SOURCES mission_repeater.cpp
  LINK_DEFAULT_LIBRARIES)
