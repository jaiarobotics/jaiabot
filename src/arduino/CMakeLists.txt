configure_file(avrdude.conf ${ARDUINO_BINARY_DIR} COPYONLY)

arduino_sketch(control_surfaces usb_old arduino:avr:nano:cpu=atmega328old arduino 57600)
arduino_sketch(control_surfaces spi     arduino:avr:nano:cpu=atmega328old jaiabot "")
arduino_sketch(control_surfaces usb_new arduino:avr:nano:cpu=atmega328    arduino 115200)
