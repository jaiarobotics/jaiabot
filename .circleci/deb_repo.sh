#!/bin/bash

set -e -u

script_dir=$(dirname $0)
default_version=$(<${script_dir}/../scripts/release_branch)

CIRCLE_BRANCH="$1"
CIRCLE_TAG="$2"

# either "repo" or "version"
RETURN_TYPE="$3"

if [ "$#" -ne 3 ]; then
    echo "Wrong number of parameters, expects 3: CIRCLE_BRANCH CIRCLE_TAG [repo|version]"
    exit 1
fi

if [[ "$RETURN_TYPE" != "repo" && "$RETURN_TYPE" != "version" ]]; then
   echo "3rd argument must be 'repo' or 'version'"
   exit 1
fi

if [ ! -z "$CIRCLE_TAG" ]; then
    # tagged release
    if [[ "$CIRCLE_TAG" == *"_"* ]]; then
        repo="beta";
    else
        repo="release";
    fi
    # extract version from tag major
    version="${CIRCLE_TAG%%.*}.y"
else
    # branch

    if [[ "$CIRCLE_BRANCH" =~ ^[0-9]+\.y$ ]]; then
       # 1.y, 2.y ,etc.
       version="$CIRCLE_BRANCH"
       repo="continuous"
    else
        # default to test/X.y repo on non-standard branches
        repo="test";
        version="${default_version}";
    fi
fi

[[ "$RETURN_TYPE" == "version" ]] && echo "$version" || true
[[ "$RETURN_TYPE" == "repo" ]] && echo "$repo" || true
