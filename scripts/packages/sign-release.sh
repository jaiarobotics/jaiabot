#!/bin/bash

set -e 

# Initialize GPG
gpg --help 1>/dev/null 2>&1 || true

rm -f Release.gpg.tmp
gpg --cert-digest-algo SHA256 --digest-algo SHA256 --batch --default-key 954A004CD5D8CF32 -abs -o Release.gpg.tmp "$1"
mv Release.gpg.tmp Release.gpg
