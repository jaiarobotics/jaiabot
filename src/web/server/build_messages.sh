#!/bin/bash

protoc -I/usr/include/ -I/usr/local/include/ -I. --python_out=. jaiabot/messages/*.proto
