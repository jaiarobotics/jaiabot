BOARD=arduino:avr:leonardo
PORT=/dev/ttyACM0
DEPLOY_FILE=${HOME}/.arduino_deployed

deploy: ${DEPLOY_FILE}

${DEPLOY_FILE}: control_surfaces.ino
	arduino-cli compile -v --upload --libraries ../libraries -p ${PORT} -b ${BOARD}
	touch ${DEPLOY_FILE}

compile:
	arduino-cli compile --libraries ../libraries -b ${BOARD}

clean:
	rm -f ${DEPLOY_FILE}

