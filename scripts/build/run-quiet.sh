#!/bin/bash
# Runs a build step, showing its output only if it fails or warns, unless JAIA_BUILD_VERBOSE is set.
#
# Usage: run-quiet.sh <command> [args...]

if [ "${JAIA_BUILD_VERBOSE:-0}" != "0" ]; then
    exec "$@"
fi

output=$("$@" 2>&1)
status=$?

if [ ${status} -ne 0 ] || grep -qi "warning" <<< "${output}"; then
    printf '%s\n' "${output}"
fi

exit ${status}
