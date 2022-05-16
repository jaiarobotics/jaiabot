set(ARDUINO_SOURCE_DIR ${project_SRC_DIR}/arduino)
set(ARDUINO_BINARY_DIR ${project_SHARE_DIR}/jaiabot/arduino)
set(ARDUINO_SERIAL_PORT /etc/jaiabot/dev/arduino CACHE STRING 
  "Serial port for Arduino flashing" )

# cache sketches so we can make a dependency chain to ensure we don't run
# arduino-cli in parallel (it can't handle that...)
unset(arduino_compile_targets CACHE)

# arduino_sketch = arduino sketch folder name and .ino name
# nickname = shorthand used in output directory and in target names
# fqbn = arduino Fully Qualified Board Name
# avrdude_programmer = avrdude "programmer" "id" in avrdude.conf file (-c avrdude flag)
# baudrate = serial baudrate for programmers that use it (-b avrdude flag)
function(arduino_sketch sketchname nickname fqbn avrdude_programmer baudrate)

  # retrieve the substring in the fqbn after "cpu="
  string(FIND "${fqbn}" "cpu=" cpu_pos)
  math(EXPR cpu_pos "${cpu_pos}+4")
  string(SUBSTRING "${fqbn}" ${cpu_pos} -1 cpu)
  
  set(outdir ${ARDUINO_BINARY_DIR}/${sketchname}/${nickname})
  set(hex_output_with_bootloader ${outdir}/${sketchname}.ino.with_bootloader.hex)
  set(hex_output ${outdir}/${sketchname}.ino.hex)

  add_custom_command(OUTPUT ${ARDUINO_SOURCE_DIR}/${sketchname}/jaiabot
    DEPENDS ${project_INC_DIR}/jaiabot
    COMMAND ${CMAKE_COMMAND} -E create_symlink ${project_INC_DIR}/jaiabot ${ARDUINO_SOURCE_DIR}/${sketchname}/jaiabot)
  
  # command to run arduino-cli to produce compiled hex
  add_custom_command(OUTPUT ${hex_output} ${hex_output_with_bootloader}
    COMMAND arduino-cli
    ARGS compile --libraries ${ARDUINO_SOURCE_DIR}/libraries --fqbn ${fqbn} --output-dir ${outdir} ${ARDUINO_SOURCE_DIR}/${sketchname}
    DEPENDS ${ARDUINO_SOURCE_DIR}/${sketchname}/${sketchname}.ino
    ${ARDUINO_SOURCE_DIR}/${sketchname}/jaiabot
    COMMENT "Running arduino-cli to compile ${sketchname} for ${nickname}")

  # target requiring compiled hex
  add_custom_target(arduino_compile_${nickname}
    ALL
    DEPENDS ${hex_output} ${hex_output_with_bootloader} jaiabot_messages_c
    ${arduino_compile_targets} # avoid running in parallel
    )

  set(arduino_compile_targets "${arduino_compile_targets};arduino_compile_${nickname}" CACHE INTERNAL "Arduino sketches")
  
  if(baudrate)
    set(baudrate_flag "-b${baudrate}")
    set(serial_port_flag "-P${ARDUINO_SERIAL_PORT}")
    set(memop_flag "-Uflash:w:${hex_output}:i")
  else()
    set(memop_flag "-Uflash:w:${hex_output_with_bootloader}:i")
  endif()

  # write an upload script for convenience of repeated or docker-based uploads
  file(WRITE ${outdir}/tmp/upload.sh
    "#!/bin/bash" "\n"
    "exec avrdude -patmega328p -C+${ARDUINO_BINARY_DIR}/avrdude.conf -c${avrdude_programmer} ${memop_flag} ${baudrate_flag} ${serial_port_flag} -v -D -V" "\n"
    )
  # work around lack of CHMOD command in this version of CMake
  file (COPY ${outdir}/tmp/upload.sh DESTINATION ${outdir} FILE_PERMISSIONS OWNER_EXECUTE OWNER_WRITE OWNER_READ)
  file (REMOVE_RECURSE ${outdir}/tmp)
  
  add_custom_target(arduino_upload_${nickname}
    DEPENDS arduino_compile_${nickname}
    COMMAND ${outdir}/upload.sh
    )
  
endfunction()

