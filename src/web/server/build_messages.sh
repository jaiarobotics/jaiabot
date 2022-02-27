#!/bin/bash

LIB_DIR=$(realpath ../../lib)
rm -f proto_include/jaiabot
mkdir -p proto_include
ln -sf $LIB_DIR proto_include/jaiabot

protoc -I/usr/local/include/ -Iproto_include --python_out=. jaiabot/messages/jaia_dccl.proto jaiabot/messages/mission.proto jaiabot/messages/geographic_coordinate.proto
