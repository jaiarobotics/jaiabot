#!/bin/bash

set -e

python_outdir='.'
[[ ! -z "$1" ]] && python_outdir="$1"
mkdir -p $python_outdir

PROTO_INCLUDE=/etc/jaiabot/proto_include/
[[ ! -z "$1" ]] && PROTO_INCLUDE="$2"

if [ ! -d ${PROTO_INCLUDE} ]
then
    mkdir -p ${PROTO_INCLUDE}
    
    ln -sf /usr/include/goby ${PROTO_INCLUDE}/goby
    ln -sf /usr/include/dccl ${PROTO_INCLUDE}/dccl
    mkdir -p ${PROTO_INCLUDE}/jaiabot
    ln -sf $(pwd)/../../lib/messages ${PROTO_INCLUDE}/jaiabot/messages
fi

echo "🟢 Building Jaia protobuf python modules"

protoc -I${PROTO_INCLUDE} -I/usr/local/include/ --python_out=$python_outdir ${PROTO_INCLUDE}/dccl/option_extensions.proto ${PROTO_INCLUDE}/goby/middleware/protobuf/*.proto ${PROTO_INCLUDE}/jaiabot/messages/*.proto

echo "✅ Done"
