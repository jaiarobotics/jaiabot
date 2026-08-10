# Shell/Python scripts that are installed onto and run by the system.
# Developer-only scripts belong in the top level "scripts" directory instead.

# etc
if(install_motd)
  install(PROGRAMS ${project_SH_DIR}/system/75-jaiabot-status DESTINATION /etc/update-motd.d/)
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
  system/jaia-update-ufw-rules.sh
  system/jaia-update-network.sh
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
foreach(script ${scripts_to_install})
    install(PROGRAMS ${project_SH_DIR}/${script} DESTINATION ${CMAKE_INSTALL_BINDIR})
    configure_file(${project_SH_DIR}/${script} ${project_BIN_DIR} COPYONLY)
endforeach()
