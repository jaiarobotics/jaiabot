file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/jed DESTINATION ${project_SHARE_DIR}/jaiabot/web)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server/app.py DESTINATION ${project_SHARE_DIR}/jaiabot/web/server)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server/jaia_portal.py DESTINATION ${project_SHARE_DIR}/jaiabot/web/server)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server/missions.py DESTINATION ${project_SHARE_DIR}/jaiabot/web/server)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server/app.wsgi DESTINATION ${project_SHARE_DIR}/jaiabot/web/server)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/jaia_cockpit_extension DESTINATION ${project_SHARE_DIR}/jaiabot/jaia_cockpit_extension)


###############################################################################
# Install npm dependencies into the jaiabot/web directory
#   npm will look here for the required packages for both jdv and command_control
#   This will ensure that both apps have the same library versions, as well as the "shared" library

add_custom_command(OUTPUT ${CMAKE_CURRENT_SOURCE_DIR}/package-lock.json ${CMAKE_CURRENT_SOURCE_DIR}/node_modules
  COMMAND ${CMAKE_CURRENT_SOURCE_DIR}/install_dependencies.sh
  ARGS ${CMAKE_CURRENT_SOURCE_DIR}
  DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/package.json
  COMMENT "Installing npm depdendencies for web apps"
  )
add_custom_target(npm_dependencies
  ALL
  DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/package-lock.json ${CMAKE_CURRENT_SOURCE_DIR}/node_modules
  )

###############################################################################

file(GLOB_RECURSE jcc_src_files FOLLOW_SYMLINKS LIST_DIRECTORIES false ${CMAKE_CURRENT_SOURCE_DIR}/command_control/*)
file(GLOB_RECURSE shared_src_files FOLLOW_SYMLINKS LIST_DIRECTORIES false ${CMAKE_CURRENT_SOURCE_DIR}/shared/*)

set(command_control_outdir ${project_SHARE_DIR}/jaiabot/web/command_control/dist/client)
add_custom_command(OUTPUT ${command_control_outdir}/client.js ${command_control_outdir}/favicon.png ${command_control_outdir}/index.html ${command_control_outdir}/manifest.json
  COMMAND ${CMAKE_CURRENT_SOURCE_DIR}/command_control/build.sh
  ARGS ${command_control_outdir}
  DEPENDS npm_dependencies ${jcc_src_files} ${shared_src_files}
  COMMENT "Running command_control build.sh"
  )
add_custom_target(command_control
  ALL
  DEPENDS npm_dependencies ${command_control_outdir}/client.js ${command_control_outdir}/favicon.png ${command_control_outdir}/index.html ${command_control_outdir}/manifest.json
  )

install(DIRECTORY ${project_SHARE_DIR}/jaiabot/web DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)

if(build_jdv)
  add_subdirectory(jdv)
endif()

option(install_jcc_apache "Install JCC Apache site" ON)
if(install_jcc_apache)
  install(FILES jcc.conf DESTINATION /etc/apache2/sites-available)
endif()

