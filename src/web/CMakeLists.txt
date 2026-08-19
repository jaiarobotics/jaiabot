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
# Generate the TypeScript protobuf types into the intermediate tree. They are not checked in;
# outside of CMake, run.sh and "npm run gen:proto" generate them into src/web/shared/proto.

set(web_proto_include_dirs ${GOBY_INCLUDE_DIR} ${DCCL_INCLUDE_DIR} ${Protobuf_INCLUDE_DIRS})
list(REMOVE_DUPLICATES web_proto_include_dirs)
list(JOIN web_proto_include_dirs ":" web_proto_include_path)

set(web_protobuf_types_stamp ${CMAKE_CURRENT_BINARY_DIR}/protobuf_types.stamp)
file(GLOB_RECURSE web_proto_files ${project_SRC_DIR}/lib/messages/*.proto)

add_custom_command(OUTPUT ${web_protobuf_types_stamp}
  COMMAND ${CMAKE_COMMAND} -E env
    "PATH=${intermediate_web_dir}/node_modules/.bin:$ENV{PATH}"
    "JAIA_PROTO_INCLUDE_DIRS=${web_proto_include_path}"
    ${CMAKE_CURRENT_SOURCE_DIR}/gen_protobuf_types.sh ${intermediate_web_dir}/shared/proto
  COMMAND ${CMAKE_COMMAND} -E touch ${web_protobuf_types_stamp}
  DEPENDS npm_dependencies ${web_proto_files}
  COMMENT "Generating TypeScript protobuf types for web apps"
  )

add_custom_target(web_protobuf_types
  ALL
  DEPENDS ${web_protobuf_types_stamp}
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

# A developer's working tree may hold types generated from older protos; drop that copy and
# clear the stamp so the intermediate tree only ever holds freshly generated ones
file(REMOVE_RECURSE ${intermediate_web_dir}/shared/proto)
file(REMOVE ${web_protobuf_types_stamp})

set(web_out_dir ${project_SHARE_DIR}/jaiabot/web)

add_custom_command(OUTPUT ${web_out_dir}/jcc/client.js ${web_out_dir}/jed/script.js
  COMMAND npx webpack
  ARGS --mode production --env OUTPUT_DIR=${web_out_dir} --stats errors-only
  COMMAND touch
  ARGS ${web_out_dir}/jcc/client.js ${web_out_dir}/jed/script.js
  WORKING_DIRECTORY ${intermediate_web_dir}/
  COMMENT "Building jcc and jed"
  DEPENDS npm_dependencies web_protobuf_types ${web_protobuf_types_stamp} ${jcc_src_files} ${jed_src_files} ${shared_src_files}
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


