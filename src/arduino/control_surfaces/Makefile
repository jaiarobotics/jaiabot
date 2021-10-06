BOARD=arduino:avr:leonardo
PORT=/dev/ttyACM0
BUILD_DIR=${PWD}/build/

deploy: ${BUILD_DIR}/control_surfaces.ino.elf
	arduino-cli upload -v -p ${PORT} -b ${BOARD}

compile: ${BUILD_DIR}/control_surfaces.ino.elf

clean:
	rm -rf build/*

${BUILD_DIR}/control_surfaces.ino.elf: control_surfaces.ino
	arduino-cli compile --build-path ${BUILD_DIR} --libraries ../libraries -b ${BOARD}

