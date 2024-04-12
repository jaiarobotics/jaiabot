#!/usr/bin/env bash

# Script to scan an image file using gdalinfo and pass the results to
# geotiff_format.py with the ultimate goal of creating a .meta.json file.
# The Jaia Command and Control webpage uses this metadata file when
# displaying the image as a Custom Overlay layer.

set -o pipefail

script_dir=$(dirname $0)

if [ $# -eq 0 ]
then
    echo "Usage: geotiff_scan.sh [FILE]...]"
    exit 1
fi

for f in "$@"
do
    if [ -f $f ]
    then
        gdalinfo -json -mm -proj4 "$f" | python3 "$script_dir/geotiff_format.py" > "$f.meta.json"
        if [[ $? -ne 0 ]]; then
            echo ""
            echo ""
            echo "Warning: The gdalinfo command did not complete successfully"
            echo "and the generated $f.meta.json file is likely not useful"
        else
            echo "Successfully wrote $f.meta.json"
        fi
    else
        echo "$f does not exist"
    fi
done