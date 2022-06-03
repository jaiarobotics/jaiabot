
#!/bin/bash

DEST_HOSTNAME=optiplex

set -e

# Convert goby files to h5 files
GOBY_FILES=`find /var/log/jaiabot/ -name '*.goby'`

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
rsync -zaP /var/log/jaiabot/ ${DEST_HOSTNAME}:jaia-logs/`hostname`
sudo rm -rf /var/log/jaiabot/*

set +x

echo "✅ Successfully uploaded all logs!"
