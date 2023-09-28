file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/adafruit_BNO055 DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/arduino DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/atlas_scientific_ezo_ec DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/gps DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/h5size DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/led_button DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/pressure_sensor DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/xbee DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/pyjaia DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/requirements.txt DESTINATION ${project_SHARE_DIR}/jaiabot/python/)

# Building the JaiaBot Goby message python modules into the pyjaia python package
set(pyjaia_outdir ${project_SHARE_DIR}/jaiabot/python/pyjaia)
add_custom_command(OUTPUT ${pyjaia_outdir}/dccl/option_extensions_pb2.py
  COMMAND ./build_messages.sh
  ARGS ${pyjaia_outdir} ${CMAKE_CURRENT_BINARY_DIR}/proto_include ${GOBY_INCLUDE_DIR} ${DCCL_INCLUDE_DIR}
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/pyjaia
  COMMENT "Running pyjaia build_messages.sh"
  )
add_custom_target(pyjaia_messages
  ALL
  DEPENDS ${pyjaia_outdir}/dccl/option_extensions_pb2.py jaiabot_messages
  )

install(DIRECTORY ${project_SHARE_DIR}/jaiabot/python DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)
