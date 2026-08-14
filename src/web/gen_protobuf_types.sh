#!/bin/bash

# Regenerates src/web/shared/proto from the .proto files in src/lib/messages.
#
# The ts-proto options below mirror what the servers actually put on the wire, which is
# google.protobuf.json_format.MessageToDict(preserving_proto_field_name=True): original field
# names, enums as their names, 64-bit integers as strings, unset fields absent.

set -e

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
proto_dir="${script_dir}/../lib/messages"
out_dir="${script_dir}/shared/proto"

# goby, dccl and google protos are installed alongside their headers
: "${JAIA_PROTO_INCLUDE_DIRS:=/usr/include}"

# npm run puts the local .bin on PATH; a CMake build installs into the intermediate directory
# instead, so callers there can put that .bin on PATH
find_npm_bin()
{
    local found
    found="$(command -v "$1" || true)"
    if [ -z "${found}" ]; then
        found="${script_dir}/node_modules/.bin/$1"
    fi
    if [ ! -x "${found}" ]; then
        echo "🔴 $1 not found - run 'npm install' in ${script_dir} first" >&2
        exit 1
    fi
    echo "${found}"
}

plugin="$(find_npm_bin protoc-gen-ts_proto)"
prettier="$(find_npm_bin prettier)"

include_args=("-I" "${proto_dir}")
for dir in ${JAIA_PROTO_INCLUDE_DIRS//:/ }; do
    include_args+=("-I" "${dir}")
done

# portal.proto and rest_api.proto transitively import every message the web apps consume
roots=(
    jaiabot/messages/portal.proto
    jaiabot/messages/rest_api.proto
)

opts=(
    onlyTypes=true
    snakeToCamel=false
    stringEnums=true
    unrecognizedEnum=false
    forceLong=string
    useOptionals=all
)

echo "🟢 Generating TypeScript protobuf types in ${out_dir}"

rm -rf "${out_dir}"
mkdir -p "${out_dir}"

protoc "${include_args[@]}" \
    --plugin=protoc-gen-ts_proto="${plugin}" \
    --ts_proto_out="${out_dir}" \
    --ts_proto_opt="$(
        IFS=,
        echo "${opts[*]}"
    )" \
    "${roots[@]}"

# match the repo style so the pre-commit prettier hook leaves the output alone
"${prettier}" --log-level warn --write "${out_dir}"
