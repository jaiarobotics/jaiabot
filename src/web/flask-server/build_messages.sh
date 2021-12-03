#!/bin/bash

protoc -I. --python_out=. rest_interface.proto

