file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/jaia_cockpit_extension DESTINATION ${project_SHARE_DIR}/jaiabot/jaia_cockpit_extension)


###############################################################################
# Install npm dependencies into the jaiabot/build/<arch>/intermediate/web directory
#   npm will look here for the required packages for both jdv and jcc
#   This will ensure that both apps have the same library versions, as well as the "shared" library

# Get the web source tree into the intermediate directory
set(intermediate_web_dir ${project_INTERMEDIATE_DIR}/web)
file(MAKE_DIRECTORY ${intermediate_web_dir})
configure_file(${CMAKE_CURRENT_SOURCE_DIR}/package.json ${intermediate_web_dir}/ COPYONLY)

add_custom_command(OUTPUT ${intermediate_web_dir}/package-lock.json ${intermediate_web_dir}/node_modules
  COMMAND ${CMAKE_CURRENT_SOURCE_DIR}/install_dependencies.sh
  ARGS ${intermediate_web_dir}
  DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/package.json
  COMMENT "Installing npm depdendencies for web apps"
  )

add_custom_target(npm_dependencies
  ALL
  DEPENDS ${intermediate_web_dir}/package-lock.json ${intermediate_web_dir}/node_modules
  )

###############################################################################


###############################################################################
# Copy the jcc source code to the build/<arch>/intermediate/web/jcc directory
# We will be compiling it there, targeting the final location.

# Get the web source tree into the intermediate directory
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/command_control DESTINATION ${intermediate_web_dir})
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/shared DESTINATION ${intermediate_web_dir})

file(GLOB_RECURSE jcc_src_files FOLLOW_SYMLINKS LIST_DIRECTORIES false ${CMAKE_CURRENT_SOURCE_DIR}/command_control/*)
file(GLOB_RECURSE shared_src_files FOLLOW_SYMLINKS LIST_DIRECTORIES false ${CMAKE_CURRENT_SOURCE_DIR}/shared/*)

set(jcc_out_dir ${project_SHARE_DIR}/jaiabot/web/jcc/client)

add_custom_command(OUTPUT ${jcc_out_dir}/client.js
  COMMAND webpack
  ARGS --mode production --env OUTPUT_DIR=${jcc_out_dir}
  WORKING_DIRECTORY ${intermediate_web_dir}/command_control/
  COMMENT "Building jcc"
  DEPENDS npm_dependencies ${jcc_src_files} ${shared_src_files}
  )
add_custom_target(jcc
  ALL
  DEPENDS ${jcc_out_dir}/client.js npm_dependencies
  )

# Copy the JCC server
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server DESTINATION ${project_SHARE_DIR}/jaiabot/web)

# Copy jed
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/jed DESTINATION ${project_SHARE_DIR}/jaiabot/web)

###############################################################################


install(DIRECTORY ${project_SHARE_DIR}/jaiabot/web DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)

if(build_jdv)
  add_subdirectory(jdv)
endif()

option(install_jcc_apache "Install JCC Apache site" ON)
if(install_jcc_apache)
  install(FILES jcc.conf DESTINATION /etc/apache2/sites-available)
endif()

