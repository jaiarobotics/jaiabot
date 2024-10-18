set(CMAKE_MODULE_PATH "${CMAKE_SOURCE_DIR}/cmake/")

include(ReadCommonVersions)

# Also need a copy in this directory for run.sh
set(I ${CMAKE_SOURCE_DIR}/src/web/package.json.in)
string(REPLACE ".in" "" OUT ${I})
configure_file(${I} ${OUT}  @ONLY)

# make output same owner as input to avoid problems running again with non-privileged user after running as root
execute_process(COMMAND chown --reference=${I} ${OUT})

