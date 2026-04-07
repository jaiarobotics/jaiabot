add_jaiabot_library(TARGET jaiabot_liaison
  SOURCES jaiabot_liaison_load.cpp liaison_jaiabot.cpp
  PRIVATE_PROTOS config.proto
  LINK_LIBRARIES goby goby_zeromq ${Boost_LIBRARIES} jaiabot_messages Wt::Wt
  COMPILE_OPTIONS -Wno-return-type-c-linkage
  CXX_STANDARD 17)
