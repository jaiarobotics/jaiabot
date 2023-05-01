#!/bin/bash

echo Remove all goby and DCCL packages.

sudo apt remove '^goby.*' '^libgoby.*'  '^dccl.*' '^libdccl.*'
