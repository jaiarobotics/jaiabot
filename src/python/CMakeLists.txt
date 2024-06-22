file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/imu DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/arduino DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/atlas_scientific_ezo_ec DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/echo DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/gps DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/h5 DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/led_button DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/pressure_sensor DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/xbee DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/pyjaia DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/Adafruit_CircuitPython_BNO08x DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/requirements.txt DESTINATION ${project_SHARE_DIR}/jaiabot/python/)


# Building the JaiaBot Goby message python modules into the pyjaia python package
set(pyjaia_outdir ${project_SHARE_DIR}/jaiabot/python/pyjaia)
add_custom_command(OUTPUT ${pyjaia_outdir}/dccl/option_extensions_pb2.py
  COMMAND ./build_messages.sh
  ARGS ${CMAKE_SOURCE_DIR} ${pyjaia_outdir}
  DEPENDS jaiabot_messages
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/pyjaia
  COMMENT "Running pyjaia build_messages.sh"
  )
add_custom_target(pyjaia_messages
  ALL
  DEPENDS ${pyjaia_outdir}/dccl/option_extensions_pb2.py jaiabot_messages
  )

install(DIRECTORY ${project_SHARE_DIR}/jaiabot/python DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)
