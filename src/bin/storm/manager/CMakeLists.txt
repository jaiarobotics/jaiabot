add_jaiabot_application(TARGET jaiabot_storm_manager
  PROTOS config.proto
  SOURCES
    app.cpp
    storm_manager.cpp
    states/self_test/air_descent_data_offload.cpp
  LINK_DEFAULT_LIBRARIES)


if(build_state_diagrams)
  generate_state_diagram(jaiabot_storm_manager)
endif()
