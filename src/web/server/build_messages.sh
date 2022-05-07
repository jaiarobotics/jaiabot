#!/bin/bash

set -e

protoc -I/usr/local/include/ -Iproto_include/ --python_out=. proto_include/goby/middleware/protobuf/*.proto proto_include/jaiabot/messages/*.proto

echo "✅ Successfully built messages"
