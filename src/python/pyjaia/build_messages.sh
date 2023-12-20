#!/bin/bash

set -e

# The root of the jaiabot directory tree, where we'll find the source proto files
JAIABOT_DIR="$1"

# Where to find the jaiabot .proto source files
JAIABOT_MESSAGES_DIR="${JAIABOT_DIR}/src/lib/messages/"

# The target directory in which to build the protobuf python files
PYTHON_OUT_DIR="$2"

echo "🟢 Building Jaia protobuf python modules"

# Set up PROTO_INCLUDE directory
PROTO_INCLUDE="${JAIABOT_DIR}/build/intermediate/proto_include/"
mkdir -p ${PROTO_INCLUDE}

rm -f ${PROTO_INCLUDE}/goby
ln -sf /usr/include/goby ${PROTO_INCLUDE}
rm -f ${PROTO_INCLUDE}/dccl
ln -sf /usr/include/dccl ${PROTO_INCLUDE}
rm -f ${PROTO_INCLUDE}/jaiabot
ln -sf "${JAIABOT_DIR}/src/lib" ${PROTO_INCLUDE}/jaiabot

# Create output directory
mkdir -p $PYTHON_OUT_DIR

protoc -I${PROTO_INCLUDE} --python_out=${PYTHON_OUT_DIR} ${PROTO_INCLUDE}/dccl/option_extensions.proto ${PROTO_INCLUDE}/goby/middleware/protobuf/*.proto ${PROTO_INCLUDE}/jaiabot/messages/*.proto
