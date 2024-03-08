file(GLOB jed_src_files ${CMAKE_CURRENT_SOURCE_DIR}/*)
set(jed_out_dir ${project_SHARE_DIR}/jaiabot/web/jed)

add_custom_command(OUTPUT ${jed_out_dir}/script.js
  COMMAND webpack
  ARGS --env OUTPUT_DIR=${jed_out_dir}
  DEPENDS npm_dependencies ${jed_src_files}
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
  COMMENT "Building jed"
  )

add_custom_target(jed
  ALL
  DEPENDS ${jed_out_dir}/script.js
  )
