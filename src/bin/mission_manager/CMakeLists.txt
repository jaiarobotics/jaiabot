add_jaiabot_application(TARGET jaiabot_mission_manager
  PROTOS config.proto
  SOURCES app.cpp mission_manager.cpp
  LINK_DEFAULT_LIBRARIES)

if(build_state_diagrams)
  generate_state_diagram(jaiabot_mission_manager)
endif()
