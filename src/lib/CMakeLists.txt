add_compile_definitions(BOOST_BIND_GLOBAL_PLACEHOLDERS=1)  # To silence global bind placeholder warning

add_subdirectory(messages)
add_subdirectory(liaison)
add_subdirectory(moos_gateway)
add_subdirectory(comms)
