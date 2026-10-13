# The STM32 HAL/CMSIS drivers are not in git; fetch the pinned versions (no-op if already present)
execute_process(COMMAND bash ${CMAKE_SOURCE_DIR}/scripts/hardware/stm32/fetch-drivers.sh
  RESULT_VARIABLE fetch_drivers_result)
if(NOT fetch_drivers_result EQUAL 0)
  message(FATAL_ERROR "Failed to fetch STM32 drivers (scripts/hardware/stm32/fetch-drivers.sh)")
endif()

add_subdirectory(bio_payload)
