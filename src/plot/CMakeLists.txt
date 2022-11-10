file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server DESTINATION ${project_SHARE_DIR}/jaiabot/plot/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/requirements.txt DESTINATION ${project_SHARE_DIR}/jaiabot/plot)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/client/dist/favicon.png DESTINATION ${project_SHARE_DIR}/jaiabot/plot/client/dist/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/client/dist/index.html DESTINATION ${project_SHARE_DIR}/jaiabot/plot/client/dist/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/client/dist/style.css DESTINATION ${project_SHARE_DIR}/jaiabot/plot/client/dist/)

set(plot_outdir ${project_SHARE_DIR}/jaiabot/plot/client/dist/)
add_custom_command(OUTPUT ${plot_outdir}/bundle.js
  COMMAND ${CMAKE_CURRENT_SOURCE_DIR}/client/build.sh
  ARGS ${plot_outdir}
  COMMENT "Running plot build.sh"
  )

add_custom_target(plot
  ALL
  DEPENDS ${plot_outdir}/bundle.js
  )

install(DIRECTORY ${project_SHARE_DIR}/jaiabot/plot DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)
