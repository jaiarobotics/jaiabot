file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/adafruit DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/arduino DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/camera DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/atlas_scientific_ezo_ec DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/pam DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/gps DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/h5 DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/led_button DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/pressure_sensor DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/xbee DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/pyjaia DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/pyjaiaprotobuf DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/Adafruit_CircuitPython_BNO08x DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/tsys01_temperature_sensor DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/requirements.txt DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/motor DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/jaia_serial DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/ubx_ppk DESTINATION ${project_SHARE_DIR}/jaiabot/python/)




#add_custom_command(OUTPUT ${pyjaiaprotobuf_outdir}/src/jaiabot/messages/jaia_dccl_pb2.py
#  COMMAND ${CMAKE_COMMAND} -E env DCCL_DIR=${DCCL_INCLUDE_DIR}/dccl GOBY_DIR=${GOBY_INCLUDE_DIR}/goby ./build_messages.sh
#  ARGS ${CMAKE_SOURCE_DIR} ${pyjaiaprotobuf_outdir}
#  DEPENDS jaiabot_messages
#  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/pyjaiaprotobuf
#  COMMENT "Running pyjaiaprotobuf build_messages.sh"
#  )
#add_custom_target(pyjaiaprotobuf
#  ALL
#  DEPENDS ${pyjaiaprotobuf_outdir}/src/jaiabot/messages/jaia_dccl_pb2.py
#  )

install(DIRECTORY ${project_SHARE_DIR}/jaiabot/python DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)
