file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/adafruit_BNO055/adafruit_bno055.py DESTINATION ${project_SHARE_DIR}/jaiabot/python/adafruit_BNO055)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/adafruit_BNO055/jaiabot_imu.py DESTINATION ${project_SHARE_DIR}/jaiabot/python/adafruit_BNO055)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/arduino DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/atlas_scientific_ezo_ec DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/gps DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/gps_wave_height/analyzer.py DESTINATION ${project_SHARE_DIR}/jaiabot/python/gps_wave_height)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/gps_wave_height/gps_wave_height.py DESTINATION ${project_SHARE_DIR}/jaiabot/python/gps_wave_height)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/gps_wave_height/gpsdsimulator.py DESTINATION ${project_SHARE_DIR}/jaiabot/python/gps_wave_height)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/gps_wave_height/udp_listener.py DESTINATION ${project_SHARE_DIR}/jaiabot/python/gps_wave_height)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/h5size DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/led_button DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/pressure_sensor DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/xbee DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/requirements.txt DESTINATION ${project_SHARE_DIR}/jaiabot/python/)

# adafruit_BNO055

set(adafruit_BNO055_outdir ${project_SHARE_DIR}/jaiabot/python/adafruit_BNO055)
add_custom_command(OUTPUT ${adafruit_BNO055_outdir}/dccl/option_extensions_pb2.py
  COMMAND ./build_messages.sh
  ARGS ${adafruit_BNO055_outdir} ${CMAKE_CURRENT_BINARY_DIR}/proto_include ${GOBY_INCLUDE_DIR} ${DCCL_INCLUDE_DIR}
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/adafruit_BNO055
  COMMENT "Running adafruit_BNO055 build_messages.sh"
  )
add_custom_target(adafruit_BNO055_messages
  ALL
  DEPENDS ${adafruit_BNO055_outdir}/dccl/option_extensions_pb2.py jaiabot_messages
  )

# gps_wave_height

set(gps_wave_height_outdir ${project_SHARE_DIR}/jaiabot/python/gps_wave_height)
add_custom_command(OUTPUT ${gps_wave_height_outdir}/dccl/option_extensions_pb2.py
  COMMAND ./build_messages.sh
  ARGS ${gps_wave_height_outdir} ${CMAKE_CURRENT_BINARY_DIR}/proto_include ${GOBY_INCLUDE_DIR} ${DCCL_INCLUDE_DIR}
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/gps_wave_height
  COMMENT "Running gps_wave_height build_messages.sh"
  )
add_custom_target(gps_wave_height_messages
  ALL
  DEPENDS ${gps_wave_height_outdir}/dccl/option_extensions_pb2.py jaiabot_messages
  )

install(DIRECTORY ${project_SHARE_DIR}/jaiabot/python DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)