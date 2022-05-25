configure_file(avrdude.conf ${ARDUINO_BINARY_DIR}/avrdude.conf COPYONLY)
install(FILES ${ARDUINO_BINARY_DIR}/avrdude.conf DESTINATION ${ARDUINO_INSTALL_DIR})

arduino_sketch(jaiabot_runtime usb_old arduino:avr:nano:cpu=atmega328old arduino 57600)
arduino_sketch(jaiabot_runtime spi     arduino:avr:nano:cpu=atmega328old jaiabot "")
arduino_sketch(jaiabot_runtime usb_new arduino:avr:nano:cpu=atmega328    arduino 115200)
