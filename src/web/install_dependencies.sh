#!/bin/bash

echo Installing npm dendencies to: $1

cd $1
npm install --no-audit
