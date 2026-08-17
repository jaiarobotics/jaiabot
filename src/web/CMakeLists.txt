###############################################################################
# Install npm dependencies into the jaiabot/build/<arch>/intermediate/web directory
#   npm will look here for the required packages for both jdv and jcc
#   This will ensure that both apps have the same library versions, as well as the "shared" library

# Get the web source tree into the intermediate directory
set(intermediate_web_dir ${project_INTERMEDIATE_DIR}/web)
file(MAKE_DIRECTORY ${intermediate_web_dir})

include(ConfigurePackageJSON)
configure_file(${CMAKE_CURRENT_SOURCE_DIR}/package.json ${intermediate_web_dir}/package.json COPYONLY)
configure_file(${CMAKE_CURRENT_SOURCE_DIR}/package-lock.json ${intermediate_web_dir}/package-lock.json COPYONLY)

add_custom_command(OUTPUT ${intermediate_web_dir}/node_modules
  COMMAND ${CMAKE_CURRENT_SOURCE_DIR}/install_dependencies.sh
  ARGS ${intermediate_web_dir}
  DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/package.json.in
  COMMENT "Installing npm dependencies for web apps"
  )

add_custom_target(npm_dependencies
  ALL
  DEPENDS ${intermediate_web_dir}/package-lock.json ${intermediate_web_dir}/node_modules
  )

###############################################################################

file(GLOB_RECURSE jcc_src_files FOLLOW_SYMLINKS LIST_DIRECTORIES false ${CMAKE_CURRENT_SOURCE_DIR}/jcc/*)
file(GLOB jed_src_files ${CMAKE_CURRENT_SOURCE_DIR}/jed/*)
file(GLOB_RECURSE shared_src_files FOLLOW_SYMLINKS LIST_DIRECTORIES false ${CMAKE_CURRENT_SOURCE_DIR}/shared/*)

###############################################################################
# Copy the jcc/jed source code to the build/<arch>/intermediate/web/ directory
# We will be compiling it there, targeting the final location.

# Get the web source tree into the intermediate directory
file(GLOB src_files LIST_DIRECTORIES TRUE ${CMAKE_CURRENT_SOURCE_DIR}/*)
list(REMOVE_ITEM src_files
  ${CMAKE_CURRENT_SOURCE_DIR}/node_modules
  ${CMAKE_CURRENT_SOURCE_DIR}/dist
  ${CMAKE_CURRENT_SOURCE_DIR}/package.json
)

file(COPY ${src_files} DESTINATION ${intermediate_web_dir})

set(web_out_dir ${project_SHARE_DIR}/jaiabot/web)

# cap the bundler heap so it collects rather than growing into the memory the
# parallel compile jobs need
add_custom_command(OUTPUT ${web_out_dir}/jcc/client.js ${web_out_dir}/jed/script.js
  COMMAND ${CMAKE_COMMAND} -E env NODE_OPTIONS=--max-old-space-size=2048 npx webpack
  ARGS --mode production --env OUTPUT_DIR=${web_out_dir} --stats errors-only
  COMMAND touch
  ARGS ${web_out_dir}/jcc/client.js ${web_out_dir}/jed/script.js
  WORKING_DIRECTORY ${intermediate_web_dir}/
  COMMENT "Building jcc and jed"
  DEPENDS npm_dependencies ${jcc_src_files} ${jed_src_files} ${shared_src_files}
  )
add_custom_target(jcc_jed
  ALL
  DEPENDS ${web_out_dir}/jcc/client.js npm_dependencies ${web_out_dir}/jed/script.js
  )

# Copy the jcc server
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/server DESTINATION ${project_SHARE_DIR}/jaiabot/web)

# Copy the REST API server
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/rest_api DESTINATION ${project_SHARE_DIR}/jaiabot/web)

###############################################################################

install(DIRECTORY ${project_SHARE_DIR}/jaiabot/web DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)

if(build_jdv)
  add_subdirectory(jdv)
endif()


