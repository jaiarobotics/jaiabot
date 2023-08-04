#!/bin/bash

set -e -u

dsh="./deb_repo.sh"


function test() {
    branch="$1"
    tag="$2"
    expected_repo="$3"
    expected_version="$4"
    repo=$($dsh "$branch" "$tag" "repo")
    version=$($dsh "$branch" "$tag" "version")
    
    if [[ "$repo" != "$expected_repo" ]]; then
        echo "ERROR: For branch: \"$branch\", tag: \"$tag\": Expected repo: $expected_repo, got $repo"
        exit 1;
    fi

    if [[ "$version" != "$expected_version" ]]; then
        echo "ERROR: For branch: \"$branch\", tag: \"$tag\": Expected version: $expected_version, got $version"
        exit 1;
    fi   
}


test "1.y" "" "continuous" "1.y"
test "2.y" "" "continuous" "2.y"
test "12.y" "" "continuous" "12.y"

test "" "1.4.0_beta2" "beta" "1.y"
test "" "2.3.0_alpha1" "beta" "2.y"
test "" "12.6.0_beta12" "beta" "12.y"

test "" "1.4.0" "release" "1.y"
test "" "2.3.0" "release" "2.y"
test "" "12.6.0" "release" "12.y"

test "foobar" "" "test" "X.y"


echo "All tests passed"
