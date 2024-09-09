#!/bin/bash

set -e

rsync -zaP -r ../ b2f2:python/

ssh b2f2 'cd python/adafruit; ./remote_test.sh'
