#!/bin/bash

OUTPUT_DIR=$1

mkdir -p ${OUTPUT_DIR}

<<<<<<< HEAD
echo 🟢 Building JCC into ${OUTPUT_DIR}
webpack --mode production --env OUTPUT_DIR=${OUTPUT_DIR}
=======
output_path='dist/client'
[[ ! -z "$1" ]] && output_path="$1"

echo "🟢 JCC:  Building app package"
npx webpack --mode development --config ./webpack.config.js --output-path $output_path # --display errors-only
echo "✅ Done"
>>>>>>> origin/1.y
