#!/bin/bash

set -u -e

cd $(dirname $(readlink -f $0))

api_host="127.0.0.1"
api_port=9092

#api_host="192.168.56.113"
#api_port=80

echo "TESTING SIMPLE (LONG) API"
./long_api_test.py --api_host=${api_host} --api_port=${api_port}


echo "TESTING FULL (SHORT) API"
./short_api_test.py  --api_host=${api_host} --api_port=${api_port}

echo "All tests passed!"
