#!/usr/bin/env bash
script_dir=$(dirname "$0")
# Always run the non-docker setup
"${script_dir}/setup-tools-build-nodocker.sh"
# Only run docker setup if DEPLOY env var is set
if [[ "$DEPLOY" == "true" ]]; then
    "${script_dir}/setup-tools-build-docker.sh"
fi
