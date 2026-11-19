#!/bin/bash
# Run migrate-from.sh --final first.
exec "$(dirname "$0")/../cutover_specialty_server.sh" "$@"
