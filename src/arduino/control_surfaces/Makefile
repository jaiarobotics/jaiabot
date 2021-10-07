BOARD=arduino:avr:leonardo
PORT=/dev/ttyACM0

deploy: deployed.yes

deployed.yes: control_surfaces.ino
	arduino-cli compile -v --upload --libraries ../libraries -p ${PORT} -b ${BOARD}
	touch deployed.yes

compile:
	arduino-cli compile --libraries ../libraries -b ${BOARD}

clean:
	rm -rf build/* deployed.yes

