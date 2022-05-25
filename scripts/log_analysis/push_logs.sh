
#!/bin/bash

DEST_HOSTNAME=optiplex

set -e

# Convert goby files to h5 files
GOBY_FILES=`find ~/jaia-logs -name '*.goby'`

for GOBY_FILE in ${GOBY_FILES}
do
    H5_FILE=${GOBY_FILE%.goby}.h5
    if [ ! -e ${H5_FILE} ]; then
        set -x
        goby_log_tool --input_file ${GOBY_FILE} --output_file ${H5_FILE} --format HDF5
        set +x
    fi
done

set -x

ssh ${DEST_HOSTNAME} mkdir -p '${HOME}'/jaia-logs/`hostname`
rsync -zaP ${HOME}/jaia-logs/ ${DEST_HOSTNAME}:jaia-logs/`hostname`
rm -rf ${HOME}/jaia-logs/*

set +x

echo "✅ Successfully uploaded all logs!"
