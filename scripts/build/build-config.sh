# Sourced by the Docker build scripts to resolve the build image name, build directory and
# Dockerfile directory from the jaiabot_* environmental variables.

jaia_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)

set -a; source "${jaia_root}/scripts/common-versions.env"; set +a

repo=${jaiabot_repo:-release}
version=${jaiabot_version:-${jaia_version_release_branch}}
version_lower=${version,,}
distro=${jaiabot_distro:-${jaia_version_ubuntu_codename}}

if [[ "${jaiabot_machine_type}" == "virtualbox" ]]; then
    arch=amd64
    image_name=jaia_build_vbox_${distro}_${repo}_${version_lower}
    build_dir=build/${distro}-${version_lower}-amd64-vbox
else
    arch=arm64
    image_name=jaia_build_${distro}_${repo}_${version_lower}
    build_dir=build/${distro}-${version_lower}-arm64
fi
