#!/bin/bash

set -e

SUDO=
[[ $UID -ne 0 ]] && SUDO=sudo

PROTO_INCLUDE=/etc/jaiabot/proto_include/

if [ ! -d ${PROTO_INCLUDE} ]
then
    $SUDO mkdir -p ${PROTO_INCLUDE}

    $SUDO ln -sf /usr/include/goby ${PROTO_INCLUDE}/goby
    $SUDO ln -sf /usr/include/dccl ${PROTO_INCLUDE}/dccl
    $SUDO mkdir -p ${PROTO_INCLUDE}/jaiabot
    $SUDO ln -sf $(pwd)/../../lib/messages ${PROTO_INCLUDE}/jaiabot/messages
fi

echo "🟢 Building Jaia protobuf python modules"

protoc -I${PROTO_INCLUDE} -I/usr/local/include/ --python_out=. ${PROTO_INCLUDE}/dccl/option_extensions.proto ${PROTO_INCLUDE}/goby/middleware/protobuf/*.proto ${PROTO_INCLUDE}/jaiabot/messages/*.proto

echo "✅ Done"
