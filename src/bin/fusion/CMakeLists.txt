add_subdirectory("wmm")

add_jaiabot_application(TARGET jaiabot_fusion
  PROTOS config.proto
  SOURCES fusion.cpp
  LINK_DEFAULT_LIBRARIES
  LINK_LIBRARIES wmm)
