add_jaiabot_application(TARGET jaiabot_failure_reporter
  PROTOS config.proto
  SOURCES app.cpp
  LINK_DEFAULT_LIBRARIES)
