add_jaiabot_application(TARGET jaiabot_state_estimator
  PROTOS config.proto
  SOURCES app.cpp
  LINK_DEFAULT_LIBRARIES
  LINK_LIBRARIES wmm)
