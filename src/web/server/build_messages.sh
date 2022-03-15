#!/bin/bash

protoc -I/usr/local/include/ -I. --python_out=. goby/middleware/protobuf/*.proto jaiabot/messages/*.proto
