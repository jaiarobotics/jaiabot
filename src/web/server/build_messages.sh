#!/bin/bash

protoc -I/usr/local/include/ -I. --python_out=. jaiabot/messages/*.proto
