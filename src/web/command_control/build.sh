#!/bin/bash

OUTPUT_DIR=$1

mkdir -p ${OUTPUT_DIR}

echo 🟢 Building JCC into ${OUTPUT_DIR}
npx webpack --mode production --env OUTPUT_DIR=${OUTPUT_DIR}
