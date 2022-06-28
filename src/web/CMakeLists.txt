file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/engineering DESTINATION ${project_SHARE_DIR}/jaiabot/web)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server/app.py DESTINATION ${project_SHARE_DIR}/jaiabot/web/server)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server/jaia.py DESTINATION ${project_SHARE_DIR}/jaiabot/web/server)

set(central_command_outdir ${project_SHARE_DIR}/jaiabot/web/central_command/dist/client)
add_custom_command(OUTPUT ${central_command_outdir}/client.js ${central_command_outdir}/favicon.png ${central_command_outdir}/index.html ${central_command_outdir}/manifest.json
  COMMAND ${CMAKE_CURRENT_SOURCE_DIR}/central_command/build.sh
  ARGS ${central_command_outdir}
  COMMENT "Running central_command build.sh"
  )
add_custom_target(central_command
  ALL
  DEPENDS ${central_command_outdir}/client.js ${central_command_outdir}/favicon.png ${central_command_outdir}/index.html ${central_command_outdir}/manifest.json
  )

set(server_outdir ${project_SHARE_DIR}/jaiabot/web/server)
add_custom_command(OUTPUT ${server_outdir}/dccl/option_extensions_pb2.py
  COMMAND ./build_messages.sh
  ARGS ${server_outdir}
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/server
  COMMENT "Running server build_messages.sh"
  )
add_custom_target(server_messages
  ALL
  DEPENDS ${server_outdir}/dccl/option_extensions_pb2.py jaiabot_messages
  )

install(DIRECTORY ${project_SHARE_DIR}/jaiabot/web DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)
