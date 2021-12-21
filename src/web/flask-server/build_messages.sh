#!/bin/bash

protoc -I/usr/local/include/ -I. --python_out=. pid_control.proto

