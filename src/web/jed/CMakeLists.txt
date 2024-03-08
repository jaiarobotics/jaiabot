file(GLOB jed_src_files ${CMAKE_CURRENT_SOURCE_DIR}/*)
set(jed_out_dir ${project_SHARE_DIR}/jaiabot/web/jed)

# Get the web source tree into the intermediate directory
file(COPY ${CMAKE_CURRENT_SOURCE_DIR} DESTINATION ${intermediate_web_dir})

add_custom_command(OUTPUT ${jed_out_dir}/script.js
  COMMAND webpack
  ARGS --env OUTPUT_DIR=${jed_out_dir} --stats errors-only
  DEPENDS npm_dependencies ${jed_src_files}
  WORKING_DIRECTORY ${intermediate_web_dir}/jed
  COMMENT "Building jed"
  )

add_custom_target(jed
  ALL
  DEPENDS ${jed_out_dir}/script.js
  )
