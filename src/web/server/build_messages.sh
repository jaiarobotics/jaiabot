#!/bin/bash

set -e

python_outdir='.'
[[ ! -z "$1" ]] && python_outdir="$1"
mkdir -p $python_outdir

PROTO_INCLUDE=/etc/jaiabot/proto_include/
[[ ! -z "$2" ]] && PROTO_INCLUDE="$2"

GOBY_INCLUDE_DIR=/usr/include
[[ ! -z "$3" ]] && GOBY_INCLUDE_DIR="$3"

DCCL_INCLUDE_DIR=/usr/include
[[ ! -z "$4" ]] && DCCL_INCLUDE_DIR="$4"


mkdir -p ${PROTO_INCLUDE}    

[[ -e "${PROTO_INCLUDE}/goby" ]] && rm ${PROTO_INCLUDE}/goby
ln -sf ${GOBY_INCLUDE_DIR}/goby ${PROTO_INCLUDE}/goby
[[ -e "${PROTO_INCLUDE}/dccl" ]] && rm ${PROTO_INCLUDE}/dccl
ln -sf ${DCCL_INCLUDE_DIR}/dccl ${PROTO_INCLUDE}/dccl
mkdir -p ${PROTO_INCLUDE}/jaiabot
[[ -e "${PROTO_INCLUDE}/jaiabot/messages" ]] && rm ${PROTO_INCLUDE}/jaiabot/messages
ln -sf $(pwd)/../../lib/messages ${PROTO_INCLUDE}/jaiabot/messages

echo "🟢 Building Jaia protobuf python modules"

protoc -I${PROTO_INCLUDE} -I/usr/local/include/ --python_out=$python_outdir ${PROTO_INCLUDE}/dccl/option_extensions.proto ${PROTO_INCLUDE}/goby/middleware/protobuf/*.proto ${PROTO_INCLUDE}/jaiabot/messages/*.proto

echo "✅ Done"
