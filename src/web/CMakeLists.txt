file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/engineering DESTINATION ${project_SHARE_DIR}/jaiabot/web)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server/app.py DESTINATION ${project_SHARE_DIR}/jaiabot/web/server)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server/jaia.py DESTINATION ${project_SHARE_DIR}/jaiabot/web/server)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server/missions.py DESTINATION ${project_SHARE_DIR}/jaiabot/web/server)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server/contours.py DESTINATION ${project_SHARE_DIR}/jaiabot/web/server)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/requirements.txt DESTINATION ${project_SHARE_DIR}/jaiabot/web)

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

set(server_outdir ${project_SHARE_DIR}/jaiabot/web/server)
add_custom_command(OUTPUT ${server_outdir}/dccl/option_extensions_pb2.py
  COMMAND ./build_messages.sh
  ARGS ${server_outdir} ${CMAKE_CURRENT_BINARY_DIR}/proto_include
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/server
  COMMENT "Running server build_messages.sh"
  )
add_custom_target(server_messages
  ALL
  DEPENDS ${server_outdir}/dccl/option_extensions_pb2.py jaiabot_messages
  )

install(DIRECTORY ${project_SHARE_DIR}/jaiabot/web DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)
