add_jaiabot_application(TARGET jaiabot_health
  PROTOS config.proto
  SOURCES app.cpp
    linux_hardware_thread.cpp
    time_thread.cpp
    helm_ivp_thread.cpp
    motor_thread.cpp
  LINK_DEFAULT_LIBRARIES
  LINK_LIBRARIES boost_filesystem sqlite3
)

# Automatically add any apps built by this project to the name -> enum mapping used by jaiabot_health to parse the goby_coroner health report name strings
foreach(JAIABOT_APP ${PROJECT_APP_LIST})
  string(TOUPPER ${JAIABOT_APP} JAIABOT_APP_UCASE)
  string(APPEND HEALTH_PROCESS_MAP_ENTRIES "MAKE_ENTRY\(${JAIABOT_APP_UCASE}\),")
endforeach()
target_compile_definitions(jaiabot_health PRIVATE JAIABOT_HEALTH_PROCESS_MAP_ENTRIES=${HEALTH_PROCESS_MAP_ENTRIES})

