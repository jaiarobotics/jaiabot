#!/bin/bash

set -e

if [ ! -d proto_include/goby ]; then
    ln -s /usr/include/goby proto_include/goby
fi

if [ ! -d proto_include/dccl ]; then
    ln -s /usr/include/dccl proto_include/dccl
fi


protoc -I/usr/local/include/ -Iproto_include/ --python_out=. proto_include/dccl/option_extensions.proto proto_include/goby/middleware/protobuf/*.proto proto_include/jaiabot/messages/*.proto

echo "✅ Successfully built messages"
