file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server DESTINATION ${project_SHARE_DIR}/jaiabot/jdv/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/requirements.txt DESTINATION ${project_SHARE_DIR}/jaiabot/jdv)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/client/dist/favicon.png DESTINATION ${project_SHARE_DIR}/jaiabot/jdv/client/dist/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/client/dist/index.html DESTINATION ${project_SHARE_DIR}/jaiabot/jdv/client/dist/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/client/dist/style.css DESTINATION ${project_SHARE_DIR}/jaiabot/jdv/client/dist/)

set(jdv_outdir ${project_SHARE_DIR}/jaiabot/jdv/client/dist/)
add_custom_command(OUTPUT ${jdv_outdir}/bundle.js
  COMMAND ${CMAKE_CURRENT_SOURCE_DIR}/client/build.sh
  ARGS ${jdv_outdir}
  COMMENT "Running jdv build.sh"
  )

add_custom_target(jdv
  ALL
  DEPENDS ${jdv_outdir}/bundle.js
  )
add_dependencies(jdv npm_depdendencies)

install(DIRECTORY ${project_SHARE_DIR}/jaiabot/jdv DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)
