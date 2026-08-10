## Lightweight standalone implementation of "jaia ip".
##
## Deliberately does not link goby/protobuf so that it starts up quickly when called
## repeatedly from non-interactive scripts; "jaia ip" execs this binary.
add_executable(jaia_ip jaia_ip.cpp)
project_install_bin(jaia_ip)
