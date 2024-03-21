#!/usr/bin/env bash

script_dir=$(dirname $0)

${script_dir}/setup-tools-build-nodocker.sh
${script_dir}/setup-tools-build-docker.sh
