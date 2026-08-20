file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/adafruit DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/arduino DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/camera DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/atlas_scientific_ezo_ec DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/echo DESTINATION ${project_SHARE_DIR}/jaiabot/python/)
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

if(build_python_venv AND NOT CMAKE_CROSSCOMPILING)
  set(jaiabot_python_share_dir ${project_SHARE_DIR}/jaiabot/python)
  set(jaiabot_python_venv_stamp ${jaiabot_python_share_dir}/venv/.venv_complete)

  file(GLOB_RECURSE jaiabot_python_venv_proto_deps CONFIGURE_DEPENDS ${project_SRC_DIR}/lib/messages/*.proto)

  # requirements.txt installs these as non-editable local paths, so pip must re-run when they
  # change. Name the source paths so pip's gitignored build/ and *.egg-info/ leftovers stay out.
  file(GLOB_RECURSE jaiabot_python_venv_pkg_deps CONFIGURE_DEPENDS
    ${CMAKE_CURRENT_SOURCE_DIR}/pyjaia/pyproject.toml
    ${CMAKE_CURRENT_SOURCE_DIR}/pyjaia/src/pyjaia/*
    ${CMAKE_CURRENT_SOURCE_DIR}/jaia_serial/pyproject.toml
    ${CMAKE_CURRENT_SOURCE_DIR}/jaia_serial/src/jaia_serial/*
    ${CMAKE_CURRENT_SOURCE_DIR}/Adafruit_CircuitPython_BNO08x/pyproject.toml
    ${CMAKE_CURRENT_SOURCE_DIR}/Adafruit_CircuitPython_BNO08x/adafruit_bno08x/*)

  add_custom_command(
    OUTPUT ${jaiabot_python_venv_stamp}
    # The file(COPY) calls at the top of this file run at configure time, not on every
    # build, so copy again here to pick up any source edits since the last configure.
    COMMAND ${CMAKE_COMMAND} -E copy_if_different ${CMAKE_CURRENT_SOURCE_DIR}/requirements.txt ${jaiabot_python_share_dir}/requirements.txt
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/pyjaia ${jaiabot_python_share_dir}/pyjaia
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/Adafruit_CircuitPython_BNO08x ${jaiabot_python_share_dir}/Adafruit_CircuitPython_BNO08x
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/jaia_serial ${jaiabot_python_share_dir}/jaia_serial
    COMMAND python3 -m venv venv --system-site-packages --clear
    COMMAND ./venv/bin/pip install -qU wheel
    COMMAND ./venv/bin/pip install -r requirements.txt
    COMMAND ${CMAKE_COMMAND} -E touch ${jaiabot_python_venv_stamp}
    WORKING_DIRECTORY ${jaiabot_python_share_dir}
    DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/requirements.txt
            ${jaiabot_python_venv_pkg_deps}
            ${jaiabot_python_venv_proto_deps}
            pyjaiaprotobuf
    COMMENT "Building Python venv for jaiabot dev/sim scripts (e.g. motor/rpm.py)"
  )

  add_custom_target(jaiabot_python_venv ALL
    DEPENDS ${jaiabot_python_venv_stamp})
endif()




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

# venv is excluded because pip hardcodes this machine's absolute paths into the console
# scripts it generates, so a packaged venv would be broken on the target. Instead,
# jaiabot-python.postinst builds the venv when the package is installed.
install(DIRECTORY ${project_SHARE_DIR}/jaiabot/python DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS
  PATTERN "venv" EXCLUDE
  )
