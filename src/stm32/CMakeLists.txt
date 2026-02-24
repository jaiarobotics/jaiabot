include(${CMAKE_SOURCE_DIR}/cmake/STM32Compile.cmake)

# sketchname  nickname  device     interface  programmer  baudrate
stm32_sketch(jaiabot_runtime stlink stm32l4x stlink stlink "")
stm32_sketch(jaiabot_runtime uart   stm32l4x stlink uart   115200)