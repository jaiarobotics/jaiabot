add_jaiabot_application(TARGET jaiabot_simulator
  PROTOS config.proto
  SOURCES 
    simulator.cpp 
    arduino_sim_thread.cpp
    gps_sim_thread.cpp
    oceanographic_sim_thread.cpp
    ezo_ec_sim_thread.cpp
    bar30_sim_thread.cpp
    hub_sim_thread.cpp
    storm_sim_thread.cpp
    imu_sim_thread.cpp
    dive_sim_thread.cpp
  LINK_DEFAULT_LIBRARIES
  LINK_LIBRARIES goby_moos
)
