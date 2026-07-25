# The World Magnetic Model library lives under fusion, which is added before this directory,
# so the target already exists; only its include path needs pointing at.
add_jaiabot_application(TARGET jaiabot_state_estimator
  PROTOS config.proto
  SOURCES app.cpp
  LINK_DEFAULT_LIBRARIES
  LINK_LIBRARIES wmm
  INCLUDE_DIRECTORIES ${project_SRC_DIR}/bin/fusion)
