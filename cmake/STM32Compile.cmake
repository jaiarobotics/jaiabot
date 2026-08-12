set(STM32_BINARY_DIR ${project_SHARE_DIR}/jaiabot/stm32)
get_target_property(STM32_NANOPB_SYSTEM_INCLUDE_DIR nanopb::protobuf-nanopb-static INTERFACE_INCLUDE_DIRECTORIES)
if(NOT STM32_NANOPB_SYSTEM_INCLUDE_DIR)
  set(STM32_NANOPB_SYSTEM_INCLUDE_DIR /usr/include/nanopb)
endif()
set(STM32_SERIAL_PORT /dev/stm32 CACHE STRING
  "Serial port for STM32 flashing")
set(STM32_INSTALL_DIR ${CMAKE_INSTALL_PREFIX}/share/jaiabot/stm32)

# stm32_sketch = STM32 project folder name
# nickname     = shorthand used in output directory and target names
# device       = OpenOCD target config (e.g. stm32l4x)
# interface    = OpenOCD interface config (e.g. stlink, cmsis-dap)
# programmer   = "stlink" or "uart"
# baudrate     = serial baudrate for uart uploads, empty for stlink
function(stm32_sketch sketchname nickname device interface programmer baudrate)

  set(STM32_SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR})
  set(outdir ${STM32_BINARY_DIR}/${sketchname}/${nickname})
  set(hex_name ${sketchname}.hex)
  set(hex_output ${outdir}/${hex_name})

  # mirror the Arduino cmake symlink pattern — create a symlink to the
  # nanopb include dir inside the sketch folder so the Makefile can find
  # both the runtime headers and the generated .pb.h files
  add_custom_command(
    OUTPUT ${STM32_SOURCE_DIR}/nanopb
    DEPENDS ${project_INC_DIR}/nanopb
    COMMAND ${CMAKE_COMMAND} -E make_directory ${STM32_SOURCE_DIR}/
    COMMAND ${CMAKE_COMMAND} -E create_symlink
      ${project_INC_DIR}/nanopb
      ${STM32_SOURCE_DIR}/nanopb
    COMMENT "Creating nanopb symlink for ${sketchname}"
  )

  add_custom_command(
    OUTPUT ${STM32_SOURCE_DIR}/jaiabot
    DEPENDS ${project_INC_DIR}/jaiabot
    COMMAND ${CMAKE_COMMAND} -E make_directory ${STM32_SOURCE_DIR}
    COMMAND ${CMAKE_COMMAND} -E create_symlink
      ${project_INC_DIR}/jaiabot
      ${STM32_SOURCE_DIR}/jaiabot
    COMMENT "Creating jaiabot messages symlink for ${sketchname}"
  )

  # compile STM32 firmware via CubeMX-generated Makefile
  add_custom_command(
    OUTPUT ${hex_output}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${outdir}
    COMMAND make
      -C ${STM32_SOURCE_DIR}
      -j
      BUILD_DIR=${outdir}
      NANOPB_INC=${project_INC_DIR}/nanopb
      JAIABOT_INC=${project_INC_DIR}
      NANOPB_SYS_INC=${STM32_NANOPB_SYSTEM_INCLUDE_DIR}
    DEPENDS
      ${STM32_SOURCE_DIR}/nanopb
      ${STM32_SOURCE_DIR}/jaiabot
      jaiabot_messages_c
    COMMENT "Building STM32 firmware ${sketchname} for ${nickname}"
  )

  # target requiring compiled hex
  add_custom_target(stm32_compile_${sketchname}_${nickname}
    ALL
    DEPENDS ${hex_output}
  )

  # set upload variables for configure_file
  if(${nickname} STREQUAL "uart")
    set(STM32_SERIAL_PORT /dev/ttyUSB0 CACHE STRING "Serial port for STM32 UART flashing")
    set(baudrate_flag "${baudrate}")
    set(serial_port_flag "${STM32_SERIAL_PORT}")
  else()
    set(baudrate_flag "")
    set(serial_port_flag "")
  endif()

  # upload script with build-time paths
  set(sharedir ${STM32_BINARY_DIR})
  configure_file(
    ${STM32_SOURCE_DIR}/upload.sh.in
    ${outdir}/upload.sh
    @ONLY
  )

  # upload script with install-time paths
  set(sharedir ${STM32_INSTALL_DIR})
  configure_file(
    ${STM32_SOURCE_DIR}/upload.sh.in
    ${outdir}/upload_installed.sh
    @ONLY
  )

  install(
    PROGRAMS ${outdir}/upload_installed.sh
    DESTINATION ${STM32_INSTALL_DIR}/${sketchname}/${nickname}
    RENAME upload.sh
  )
  install(
    FILES ${hex_output}
    DESTINATION ${STM32_INSTALL_DIR}/${sketchname}/${nickname}
  )

  # copy deploy script and stm32flash tool into the build output directory
  if(${nickname} STREQUAL "uart")
    set(deploy_script ${CMAKE_SOURCE_DIR}/scripts/stm32/deploy_${sketchname}.sh)
    if(NOT EXISTS ${deploy_script})
      message(FATAL_ERROR "No deploy script found for sketch '${sketchname}': expected ${deploy_script}")
    endif()
    add_custom_command(TARGET stm32_compile_${sketchname}_${nickname} POST_BUILD
      COMMAND ${CMAKE_COMMAND} -E copy
        ${deploy_script}
        ${outdir}/upload.sh
      COMMAND ${CMAKE_COMMAND} -E copy
        ${CMAKE_SOURCE_DIR}/scripts/stm32/stm32flash-0.7.tar.gz
        ${outdir}/stm32flash-0.7.tar.gz
      COMMENT "Copying deploy script and stm32flash to ${outdir}"
    )
    install(
      PROGRAMS ${deploy_script}
      DESTINATION ${STM32_INSTALL_DIR}/${sketchname}/${nickname}
      RENAME upload.sh
    )
    install(
      FILES ${CMAKE_SOURCE_DIR}/scripts/stm32/stm32flash-0.7.tar.gz
      DESTINATION ${STM32_INSTALL_DIR}/${sketchname}/${nickname}
    )
  endif()

  add_custom_target(stm32_upload_${sketchname}_${nickname}
    DEPENDS stm32_compile_${sketchname}_${nickname}
    COMMAND ${outdir}/upload.sh
  )

endfunction()
