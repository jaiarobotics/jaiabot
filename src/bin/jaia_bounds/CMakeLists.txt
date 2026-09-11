## Lightweight standalone implementation of "jaia admin bounds".
##
## Deliberately does not link goby/protobuf so that it starts up quickly when called
## from non-interactive scripts; "jaia admin bounds" execs this binary.
add_executable(jaia_bounds jaia_bounds.cpp)
project_install_bin(jaia_bounds)
