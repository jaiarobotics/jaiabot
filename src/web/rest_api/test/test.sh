#!/bin/bash

set -u -e

cd $(dirname $(readlink -f $0))

echo "TESTING SIMPLE (LONG) API"
./long_api_test.py


echo "TESTING FULL (SHORT) API"
./short_api_test.py

echo "All tests passed!"
