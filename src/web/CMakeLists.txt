file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/jed DESTINATION ${project_SHARE_DIR}/jaiabot/web)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server/app.py DESTINATION ${project_SHARE_DIR}/jaiabot/web/server)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server/jaia_portal.py DESTINATION ${project_SHARE_DIR}/jaiabot/web/server)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server/missions.py DESTINATION ${project_SHARE_DIR}/jaiabot/web/server)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server/app.wsgi DESTINATION ${project_SHARE_DIR}/jaiabot/web/server)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server/jaiabot/contours.py DESTINATION ${project_SHARE_DIR}/jaiabot/web/server/jaiabot)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/requirements.txt DESTINATION ${project_SHARE_DIR}/jaiabot/web)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/jaia_cockpit_extension DESTINATION ${project_SHARE_DIR}/jaiabot/jaia_cockpit_extension)


###############################################################################
# Install npm dependencies into the jaiabot/web directory
#   npm will look here for the required packages for both jdv and command_control
#   This will ensure that both apps have the same library versions, as well as the "shared" library

add_custom_command(OUTPUT ${CMAKE_CURRENT_SOURCE_DIR}/package-lock.json ${CMAKE_CURRENT_SOURCE_DIR}/node_modules
  COMMAND ${CMAKE_CURRENT_SOURCE_DIR}/install_dependencies.sh
  ARGS ${CMAKE_CURRENT_SOURCE_DIR}
  COMMENT "Installing npm depdendencies for web apps"
  )
add_custom_target(npm_depdendencies
  ALL
  DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/package-lock.json ${CMAKE_CURRENT_SOURCE_DIR}/node_modules
  )

###############################################################################


set(command_control_outdir ${project_SHARE_DIR}/jaiabot/web/command_control/dist/client)
add_custom_command(OUTPUT ${command_control_outdir}/client.js ${command_control_outdir}/favicon.png ${command_control_outdir}/index.html ${command_control_outdir}/manifest.json
  COMMAND ${CMAKE_CURRENT_SOURCE_DIR}/command_control/build.sh
  ARGS ${command_control_outdir}
  COMMENT "Running command_control build.sh"
  )
add_custom_target(command_control
  ALL
  DEPENDS ${command_control_outdir}/client.js ${command_control_outdir}/favicon.png ${command_control_outdir}/index.html ${command_control_outdir}/manifest.json
  )
add_dependencies(command_control npm_depdendencies)

set(server_outdir ${project_SHARE_DIR}/jaiabot/web/server)
add_custom_command(OUTPUT ${server_outdir}/dccl/option_extensions_pb2.py
  COMMAND ./build_messages.sh
  ARGS ${server_outdir} ${CMAKE_CURRENT_BINARY_DIR}/proto_include ${GOBY_INCLUDE_DIR} ${DCCL_INCLUDE_DIR}
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/server
  COMMENT "Running server build_messages.sh"
  )
add_custom_target(server_messages
  ALL
  DEPENDS ${server_outdir}/dccl/option_extensions_pb2.py jaiabot_messages
  )

install(DIRECTORY ${project_SHARE_DIR}/jaiabot/web DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)

if(build_jdv)
  add_subdirectory(jdv)
endif()

option(install_jcc_apache "Install JCC Apache site" ON)
if(install_jcc_apache)
  install(FILES jcc.conf DESTINATION /etc/apache2/sites-available)
endif()

