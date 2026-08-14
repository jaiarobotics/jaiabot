# Shell/Python scripts that are installed onto and run by the system.
# Developer-only scripts belong in the top level "scripts" directory instead.

# etc
if(install_motd)
  install(PROGRAMS ${project_SH_DIR}/system/75-jaiabot-status DESTINATION /etc/update-motd.d/)
endif()

if(install_profile)
  install(FILES ${project_SH_DIR}/system/jaia-profile.sh DESTINATION /etc/profile.d/ RENAME jaia.sh)
endif()

install(PROGRAMS ${project_SH_DIR}/system/75-jaiabot-status DESTINATION ${CMAKE_INSTALL_BINDIR} RENAME jaiabot-status)

set(scripts_to_install
  # data offload
  data-offload/jaiahub-dataoffload.sh
  data-offload/jaiabot-predataoffload.sh
  data-offload/jaiabot-postdataoffload.sh
  data-offload/jaiahub-dataoffload-cloudhub.sh
  # Firmware scripts
  firmware/jaia-firm-backup-date.sh
  firmware/jaia-reset-bio-payload-board.sh
  # Utilities
  utils/jaia-geotiff-format.py
  utils/jaia-geotiff-scan.sh
  utils/jaia-doc.py
  utils/jaia-vpn-gen.sh
  # System scripts
  system/jaiabot-checkloadavg.py
  system/jaia-debconf.sh
  system/jaia-update-ufw-rules.sh
  system/jaia-update-network.sh
  system/jaia-update-dns.sh
  system/jaia-iridium-tunnel.sh
  # Fleet config
  fleet/jaia-create-fleet-config.sh
  fleet/jaia-generate-first-boot.py
  fleet/jaia-fleet-config-update-iso.sh
  fleet/jaia-create-cloudhub.py
  fleet/jaia-delete-cloudhub.py
  # First boot (also used by VirtualFleet creation)
  init/jaia-create-ansible-inventory.sh
  )

# Iterate over each script to install and copy
#
# Note: the build-directory copy is done with a build-time add_custom_command
# rather than configure_file(), because configure_file() registers its input
# as a CMake reconfigure dependency. Since this is a single monolithic CMake
# project, touching any one of these scripts would then force a full
# reconfigure (and consequent rebuild churn) of the entire repo.
set(sh_scripts_bin_copies)
foreach(script ${scripts_to_install})
    install(PROGRAMS ${project_SH_DIR}/${script} DESTINATION ${CMAKE_INSTALL_BINDIR})

    get_filename_component(script_name ${script} NAME)
    set(script_bin_copy ${project_BIN_DIR}/${script_name})
    add_custom_command(
      OUTPUT ${script_bin_copy}
      COMMAND ${CMAKE_COMMAND} -E copy ${project_SH_DIR}/${script} ${script_bin_copy}
      DEPENDS ${project_SH_DIR}/${script}
      COMMENT "Copying ${script} to ${project_BIN_DIR}"
      )
    list(APPEND sh_scripts_bin_copies ${script_bin_copy})
endforeach()

add_custom_target(copy_sh_scripts ALL DEPENDS ${sh_scripts_bin_copies})
