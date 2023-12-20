set(jdv_outdir ${project_SHARE_DIR}/jaiabot/web/jdv/)
set(jdv_client_outdir ${jdv_outdir}/client/dist/)

file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server DESTINATION ${jdv_outdir})

add_custom_command(OUTPUT ${jdv_client_outdir}/bundle.js
  COMMAND ${CMAKE_CURRENT_SOURCE_DIR}/client/build.sh
  ARGS ${jdv_client_outdir}
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/client
  COMMENT "Running jdv build.sh"
  DEPENDS npm_depdendencies
  )

add_custom_target(jdv
  ALL
  DEPENDS ${jdv_client_outdir}/bundle.js
  )
add_dependencies(jdv npm_depdendencies)

install(DIRECTORY ${jdv_outdir} DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)
