###############################################################################
# Install npm dependencies into the jaiabot/build/<arch>/intermediate/web directory
#   npm will look here for the required packages for both jdv and jcc
#   This will ensure that both apps have the same library versions, as well as the "shared" library

# Get the web source tree into the intermediate directory
set(intermediate_web_dir ${project_INTERMEDIATE_DIR}/web)
file(MAKE_DIRECTORY ${intermediate_web_dir})

include(ConfigurePackageJSON)
configure_file(${CMAKE_CURRENT_SOURCE_DIR}/package.json ${intermediate_web_dir}/package.json COPYONLY)

add_custom_command(OUTPUT ${intermediate_web_dir}/package-lock.json ${intermediate_web_dir}/node_modules
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
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/webpack.config.js DESTINATION ${intermediate_web_dir})
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/tsconfig.json DESTINATION ${intermediate_web_dir})

file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/components DESTINATION ${intermediate_web_dir})
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/containers DESTINATION ${intermediate_web_dir})
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/context DESTINATION ${intermediate_web_dir})

file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/jcc DESTINATION ${intermediate_web_dir})
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/jed DESTINATION ${intermediate_web_dir})

file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/shared DESTINATION ${intermediate_web_dir})
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/utils DESTINATION ${intermediate_web_dir})

set(web_out_dir ${project_SHARE_DIR}/jaiabot/web)

add_custom_command(OUTPUT ${web_out_dir}/jcc/client.js ${web_out_dir}/jed/script.js
  COMMAND npx webpack
  ARGS --mode production --env OUTPUT_DIR=${web_out_dir} --stats errors-only
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

option(install_jcc_apache "Install jcc Apache site" ON)
if(install_jcc_apache)
  install(FILES jcc.conf DESTINATION /etc/apache2/sites-available)
endif()

