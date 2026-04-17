add_jaiabot_application(TARGET jaiabot_mission_manager
  PROTOS config.proto
  SOURCES app.cpp mission_manager.cpp
  LINK_DEFAULT_LIBRARIES)
