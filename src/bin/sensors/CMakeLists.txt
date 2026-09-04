add_jaiabot_application(TARGET jaiabot_sensors
  PROTOS config.proto
  SOURCES app.cpp
    drivers/atlas_scientific__oem_ec.cpp
    drivers/atlas_scientific__oem_do.cpp
    drivers/atlas_scientific__oem_ph.cpp
    drivers/blue_robotics_bar30.cpp
    drivers/turner__c_fluor.cpp
    drivers/aml.cpp
    drivers/celsius_tsys01.cpp
  LINK_DEFAULT_LIBRARIES)
