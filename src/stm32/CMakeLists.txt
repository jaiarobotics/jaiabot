# The STM32 HAL/CMSIS drivers are not in git; fetch the pinned versions (no-op if already present)
execute_process(COMMAND bash ${CMAKE_SOURCE_DIR}/scripts/hardware/stm32/fetch-drivers.sh
  RESULT_VARIABLE fetch_drivers_result
  OUTPUT_VARIABLE fetch_drivers_output
  OUTPUT_STRIP_TRAILING_WHITESPACE)
message(STATUS "${fetch_drivers_output}")
if(NOT fetch_drivers_result EQUAL 0)
  message(FATAL_ERROR "Failed to fetch STM32 drivers (scripts/hardware/stm32/fetch-drivers.sh)")
endif()

add_subdirectory(bio_payload)
