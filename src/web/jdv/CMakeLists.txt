set(jdv_outdir ${project_SHARE_DIR}/jaiabot/web/jdv/)
set(jdv_client_outdir ${jdv_outdir}/client/dist/)

# Copy the jdv server
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server DESTINATION ${jdv_outdir})

###############################################################################
# Copy the jdv source code to the build/<arch>/intermediate/web/jdv directory
# We will be compiling it there, targeting the final location.

file(GLOB_RECURSE jdv_src_files FOLLOW_SYMLINKS LIST_DIRECTORIES false ${CMAKE_CURRENT_SOURCE_DIR}/jdv/*)

file(COPY ${CMAKE_CURRENT_SOURCE_DIR} DESTINATION ${intermediate_web_dir})

file(GLOB_RECURSE jdv_src_files FOLLOW_SYMLINKS LIST_DIRECTORIES false ${CMAKE_CURRENT_SOURCE_DIR}/client/src/*)
file(GLOB jdv_dist_files FOLLOW_SYMLINKS LIST_DIRECTORIES false ${CMAKE_CURRENT_SOURCE_DIR}/client/dist/*)
file(GLOB jdv_other_files FOLLOW_SYMLINKS LIST_DIRECTORIES false ${CMAKE_CURRENT_SOURCE_DIR}/client/*)

add_custom_command(OUTPUT ${jdv_client_outdir}/bundle.js
  COMMAND npx webpack
  ARGS --mode production --config ./release.webpack.config.js --env TARGET_DIR=${jdv_client_outdir} --stats errors-only
  WORKING_DIRECTORY ${intermediate_web_dir}/jdv/client
  COMMENT "Building jdv"
  DEPENDS npm_dependencies ${jdv_src_files}
  )

add_custom_target(jdv
  ALL
  DEPENDS npm_dependencies ${jdv_client_outdir}/bundle.js
  )

install(DIRECTORY ${jdv_outdir} DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)
