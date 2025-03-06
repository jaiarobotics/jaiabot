add_library(jaiabot_wifi SHARED
  udp_driver.cpp)

project_install_lib(jaiabot_wifi)
  
target_link_libraries(jaiabot_wifi
  goby
  jaiabot_messages
)
