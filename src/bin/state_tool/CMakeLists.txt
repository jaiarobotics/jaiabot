set(APP jaia_state_tool)

# Find Clang 18 via its CMake config (which transitively finds the correct LLVM version)
find_package(Clang REQUIRED CONFIG
  HINTS /usr/lib/llvm-18/lib/cmake/clang)

message(STATUS "Found Clang ${LLVM_PACKAGE_VERSION} (for jaia_state_tool)")

add_executable(${APP} jaia_state_tool.cpp)

target_include_directories(${APP} PRIVATE
  ${LLVM_INCLUDE_DIRS}
  ${CLANG_INCLUDE_DIRS})

target_compile_definitions(${APP} PRIVATE
  ${LLVM_DEFINITIONS})

# Use the Clang C++ shared library (CLANG_LINK_CLANG_DYLIB is ON for distro packages)
target_link_libraries(${APP}
  clang-cpp
  LLVM-18)

# jaia_state_tool is a build-time tool; install to bin for use in custom commands
install(TARGETS ${APP} DESTINATION ${CMAKE_INSTALL_BINDIR})
