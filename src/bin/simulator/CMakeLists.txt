add_jaiabot_application(TARGET jaiabot_simulator
  PROTOS config.proto
  SOURCES simulator.cpp arduino_sim_thread.cpp
  LINK_DEFAULT_LIBRARIES
  LINK_LIBRARIES goby_moos
)

