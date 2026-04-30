add_jaiabot_application(TARGET jaiabot_hub_manager
  PROTOS config.proto
  SOURCES hub_manager.cpp
  LINK_DEFAULT_LIBRARIES
  LINK_LIBRARIES jaiabot_xbee
)
