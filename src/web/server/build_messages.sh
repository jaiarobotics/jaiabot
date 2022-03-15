#!/bin/bash

if [ ! -d goby ]; then
    ln -s /usr/include/goby goby
fi

protoc -I/usr/local/include/ -I. --python_out=. goby/middleware/protobuf/*.proto jaiabot/messages/*.proto
