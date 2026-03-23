add_jaiabot_application(TARGET jaiabot_storm_manager
  PROTOS config.proto
  SOURCES app.cpp storm_manager.cpp
  LINK_DEFAULT_LIBRARIES)

