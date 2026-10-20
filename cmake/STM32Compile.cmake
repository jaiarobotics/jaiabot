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

  # Like the Arduino cmake: symlink the nanopb include dir into the sketch folder
  # so the Makefile finds both the runtime headers and the generated .pb.h files.
  file(CREATE_LINK ${project_INC_DIR}/nanopb ${STM32_SOURCE_DIR}/nanopb SYMBOLIC)
  file(CREATE_LINK ${project_INC_DIR}/jaiabot ${STM32_SOURCE_DIR}/jaiabot SYMBOLIC)

  file(GLOB_RECURSE firmware_sources
    ${STM32_SOURCE_DIR}/Core/*
    ${STM32_SOURCE_DIR}/*.s
    ${STM32_SOURCE_DIR}/*.ld)

  # compile STM32 firmware via CubeMX-generated Makefile. The stamp rather than the hex is the
  # output so the hex keeps the mtime upload.sh compares against when make has nothing to do.
  set(build_stamp ${outdir}/build.stamp)
  add_custom_command(
    OUTPUT ${build_stamp}
    BYPRODUCTS ${hex_output}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${outdir}
    # the Makefile appends to CFLAGS, so host flags from the environment (e.g. dpkg-buildflags
    # under debian/rules) would otherwise reach the bare-metal cross compiler
    COMMAND ${JAIA_RUN_QUIET} ${CMAKE_COMMAND} -E env --unset=CFLAGS --unset=CPPFLAGS --unset=ASFLAGS --unset=LDFLAGS
      make
      --no-print-directory
      -C ${STM32_SOURCE_DIR}
      -j
      BUILD_DIR=${outdir}
      NANOPB_INC=${project_INC_DIR}/nanopb
      JAIABOT_INC=${project_INC_DIR}
      NANOPB_SYS_INC=${STM32_NANOPB_SYSTEM_INCLUDE_DIR}
    COMMAND ${CMAKE_COMMAND} -E touch ${build_stamp}
    DEPENDS
      ${firmware_sources}
      ${STM32_SOURCE_DIR}/Makefile
      jaiabot_messages_c
    COMMENT "Building STM32 firmware ${sketchname} for ${nickname}"
  )

  # target requiring compiled hex
  add_custom_target(stm32_compile_${sketchname}_${nickname}
    ALL
    DEPENDS ${build_stamp}
  )

  if(${nickname} STREQUAL "uart")
    # the deploy script and stm32flash tool stand in for the upload.sh.in template
    string(REPLACE "_" "-" sketch_script_name ${sketchname})
    set(deploy_script ${CMAKE_SOURCE_DIR}/scripts/hardware/stm32/deploy-${sketch_script_name}.sh)
    if(NOT EXISTS ${deploy_script})
      message(FATAL_ERROR "No deploy script found for sketch '${sketchname}': expected ${deploy_script}")
    endif()
    set(stm32flash_tarball ${CMAKE_SOURCE_DIR}/scripts/hardware/stm32/stm32flash-0.7.tar.gz)
    add_custom_command(
      OUTPUT ${outdir}/upload.sh ${outdir}/stm32flash-0.7.tar.gz
      COMMAND ${CMAKE_COMMAND} -E make_directory ${outdir}
      COMMAND ${CMAKE_COMMAND} -E copy ${deploy_script} ${outdir}/upload.sh
      COMMAND ${CMAKE_COMMAND} -E copy ${stm32flash_tarball} ${outdir}/stm32flash-0.7.tar.gz
      DEPENDS ${deploy_script} ${stm32flash_tarball}
      COMMENT "Copying deploy script and stm32flash to ${outdir}"
    )
    add_custom_target(stm32_deploy_files_${sketchname}_${nickname}
      DEPENDS ${outdir}/upload.sh ${outdir}/stm32flash-0.7.tar.gz)
    add_dependencies(stm32_compile_${sketchname}_${nickname} stm32_deploy_files_${sketchname}_${nickname})

    install(
      PROGRAMS ${deploy_script}
      DESTINATION ${STM32_INSTALL_DIR}/${sketchname}/${nickname}
      RENAME upload.sh
    )
    install(
      FILES ${stm32flash_tarball}
      DESTINATION ${STM32_INSTALL_DIR}/${sketchname}/${nickname}
    )
  else()
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
  endif()

  install(
    FILES ${hex_output}
    DESTINATION ${STM32_INSTALL_DIR}/${sketchname}/${nickname}
  )

  add_custom_target(stm32_upload_${sketchname}_${nickname}
    DEPENDS stm32_compile_${sketchname}_${nickname}
    COMMAND ${outdir}/upload.sh
  )

endfunction()
