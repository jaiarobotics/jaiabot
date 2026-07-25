# Offline tool: depends only on the header-only nav library, so it builds without goby.
add_executable(jaiabot_nav_replay main.cpp)
set_target_properties(jaiabot_nav_replay PROPERTIES OUTPUT_NAME nav_replay)
install(TARGETS jaiabot_nav_replay DESTINATION ${CMAKE_INSTALL_BINDIR})
