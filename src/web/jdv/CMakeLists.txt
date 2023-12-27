set(jdv_outdir ${project_SHARE_DIR}/jaiabot/web/jdv/)
set(jdv_client_outdir ${jdv_outdir}/client/dist/)

file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server DESTINATION ${jdv_outdir})
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/client/dist/favicon.png DESTINATION ${jdv_client_outdir})
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/client/dist/index.html DESTINATION ${jdv_client_outdir})

file(GLOB_RECURSE jdv_src_files FOLLOW_SYMLINKS LIST_DIRECTORIES false ${CMAKE_CURRENT_SOURCE_DIR}/client/src/*)
file(GLOB jdv_dist_files FOLLOW_SYMLINKS LIST_DIRECTORIES false ${CMAKE_CURRENT_SOURCE_DIR}/client/dist/*)
file(GLOB jdv_other_files FOLLOW_SYMLINKS LIST_DIRECTORIES false ${CMAKE_CURRENT_SOURCE_DIR}/client/*)

add_custom_command(OUTPUT ${jdv_client_outdir}/bundle.js
  COMMAND ${CMAKE_CURRENT_SOURCE_DIR}/client/build.sh
  ARGS ${jdv_client_outdir}
  COMMENT "Running jdv build.sh"
  DEPENDS npm_dependencies ${jdv_src_files} ${jdv_dist_files} ${jdv_other_files}
  )

add_custom_target(jdv
  ALL
  DEPENDS npm_dependencies ${jdv_client_outdir}/bundle.js
  )

install(DIRECTORY ${jdv_outdir} DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)
