# JaiaBot Repositories

The JaiaBot source code lives in the `jaiabot` Git repository (<https://github.com/jaiarobotics/jaiabot>).

It consists of source code that is compiled into a variety of binary applications and libraries to be run on the target platforms (vehicles and base station computers). This compilation can be carried out manually by the developers on their computers and automatically be the CircleCI service for the target hardware. See [Building and CI/CD](page20_build.md) for more details.

- `jaiabot`
  - `src`: Source code (C++ primarily) that is built into compiled code (binaries and libraries)
  - `rootfs`: Root filesystem generation for jaiabot (prior to 1.12.0 this was the separate `jaiabot-rootfs-gen` repository).
  - `debian`: Debian packaging files for jaiabot (prior to 1.12.0 this was the separate `jaiabot-debian` repository).

# Release Branches

`jaiabot` manages several release series at once:

- Legacy (N/A) - Will be 1.y in the future.
- Stable (1.y) - Stable code that receives primarily bug fixes and low risk features
- Testing (2.y) - Superset of stable that includes most of the new development.

Over time the Stable release will become Legacy, the Testing will become Stable, and a new Testing release branch will be created.

## Ubuntu Releases

Each `jaiabot` release series is aligned to an long-term support (LTS) release of Ubuntu (except 1.y which supports two LTS releases as a special case):

- jaiabot 1.y: Ubuntu 20.04 (focal) and 22.04 (jammy)
- jaiabot 2.y (forthcoming, expected Oct 2024): Ubuntu 24.04 (noble)
- jaiabot 3.y (future, expected Oct 2026): Ubuntu 26.04

## Updates to create new release branch

Whenever a new release branch is created, the following must be done:

- Update text in this document for Legacy/Stable/Testing branches.
- Create new release branch (X.y) where X is one greater than the current Testing. For example, `git checkout -b 2.y 1.y`
- Update `jaiabot/scripts/release_branch` with this new release branch (e.g., '2.y').
- Update `jaiabot/scripts/packages/update_gobysoft_mirror.sh` to include an entry for the new release branch and add a 'distros_for_releases' key mapping the supported Ubuntu distros for this release branch (comma separated).
  - Copy to /opt/jaia_packages on packages.jaia.tech.
  - Run ./update_gobysoft_mirror.sh on packages.jaia.tech to pull the new staging mirror for this release branch.
- Update `jaiabot/.circleci/config.yml`:
  - Change to new release branch in all the "filter-template-\*" lists.
  - Change distros targeted by this release branch.
- Add new entries for release, beta, continuous, and test for the new release branch to `jaiabot/.circleci/dput.cf`.
- Add new directories to packages.jaia.tech:

```
release_branch=2.y
for repo in test continuous beta release; do
	sudo -E mkdir -p /var/www/html/ubuntu/${repo}/${release_branch}/mini-dinstall/incoming
done
sudo chown -R dput /var/www/html/ubuntu/
```

- Make a git tag and push it as a point of reference for commits until the first release, such as `git tag 2.0.0_alpha1 && git push --tags`.
- Update `.circleci/test_deb_repo.sh` to test for new release branch in non-standard branches

# Ubuntu Distributions

To add a new Ubuntu distribution:

- Update `jaiabot/scripts/packages/mini-dinstall.conf` and copy to packages.jaia.tech (in /opt/jaia_packages).
- On packages.jaia.tech, run:

```
sudo su dput
release_branch=2.y
for repo in test continuous beta release; do
    /usr/bin/mini-dinstall --batch --config=/opt/jaia_packages/mini-dinstall.conf /var/www/html/ubuntu/${repo}/${release_branch}
done
```

- Also on packages.jaia.tech update the staging mirror and manually copy the new distro to release:

```
release_branch=2.y
new_distro=noble
sudo -E rsync -aP /var/spool/apt-mirror/staging/${release_branch}/mirror/packages.gobysoft.org/ubuntu/release/${new_distro} /var/spool/apt-mirror/release/${release_branch}/mirror/packages.gobysoft.org/ubuntu/release/
```

- Symlink old docker (preferred) or create new for new distro in `jaiabot/.docker`
- Add new distro to `docker-create-push-for-circleci.sh` and run `docker-create-push-for-circleci.sh {distroname}`
