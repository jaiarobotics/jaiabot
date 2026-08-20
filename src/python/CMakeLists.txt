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

if(NOT CMAKE_CROSSCOMPILING)
	set(jaiabot_python_share_dir ${project_SHARE_DIR}/jaiabot/python)
	set(jaiabot_python_venv_stamp ${jaiabot_python_share_dir}/venv/.venv_complete)

	file(GLOB_RECURSE jaiabot_python_venv_proto_deps ${project_SRC_DIR}/lib/messages/*.proto)

	# requirements.txt installs these as non-editable local paths, so pip has to be re-run
	# whenever their sources change (pyjaiaprotobuf is covered by its own target below).
	file(GLOB_RECURSE jaiabot_python_venv_pkg_deps
		${CMAKE_CURRENT_SOURCE_DIR}/pyjaia/*
		${CMAKE_CURRENT_SOURCE_DIR}/Adafruit_CircuitPython_BNO08x/*
		${CMAKE_CURRENT_SOURCE_DIR}/jaia_serial/*)

	# Drop VCS/CI metadata and gitignored build leftovers (build/, *.egg-info, __pycache__).
	# They are not inputs to the install, and depending on them would break the build for
	# anyone whose checkout does not happen to have them.
	list(FILTER jaiabot_python_venv_pkg_deps EXCLUDE REGEX
		"(^|/)(\\.git|\\.github|__pycache__|\\.pytest_cache|build)(/|$)|\\.egg-info/|\\.pyc$")

	add_custom_command(
		OUTPUT ${jaiabot_python_venv_stamp}
		# pip installs from the copies in the share dir, but the file(COPY) calls above only
		# run at configure time. Refresh them here so an incremental build installs the
		# current sources instead of whatever was copied at the last cmake run.
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

install(DIRECTORY ${project_SHARE_DIR}/jaiabot/python DESTINATION share/jaiabot USE_SOURCE_PERMISSIONS)
