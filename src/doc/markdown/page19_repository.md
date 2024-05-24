# JaiaBot Repositories
The JaiaBot source code lives in the following Git repositories:

* `jaiabot`: Source code (C++ primarily) that is built into compiled code (binaries and libraries)
* `jaiabot-rootfs-gen`: Root filesystem generation for jaiabot
* `jaiabot-debian`: Debian packaging files for jaiabot

## jaiabot
This Git repository is hosted at: <https://github.com/jaiarobotics/jaiabot>

It consists of source code that is compiled into a variety of binary applications and libraries to be run on the target platforms (vehicles and base station computers). This compilation can be carried out manually by the developers on their computers and automatically be the CircleCI service for the target hardware. See [Building and CI/CD](page20_build.md) for more details.

## jaiabot-rootfs-gen
This Git repository is hosted at: <https://github.com/jaiarobotics/jaiabot-rootfs-gen>

## jaiabot-debian
This Git repository is hosted at: <https://github.com/jaiarobotics/jaiabot-debian>

# Release Branches

`jaiabot` manages several release series at once:

- Legacy (N/A) - Will be 1.y in the future.
 - Stable (1.y) - Stable code that receives primarily bug fixes and low risk features 
 - Testing (2.y) - Superset of stable that includes most of the new development.
 
Over time the Stable release will become Legacy, the Testing will become Stable, and a new Testing release branch will be created.

## Updates to create new release branch

Whenever a new release branch is created, the following must be done:

- Update text in this document for Legacy/Stable/Testing branches.
- Create new release branch (X.y) where X is one greater than the current Testing. For example, `git checkout -b 2.y 1.y`
- Update `jaiabot/scripts/release_branch` with this new release branch (e.g., '2.y').
- Update `jaiabot/scripts/packages/update_gobysoft_mirror.sh` to include an entry for the new release branch and add a 'distros_for_releases' key mapping the supported Ubuntu distros for this release branch (comma separated).
  -  Copy to /opt/jaia_packages on packages.jaia.tech.
  - Run ./update_gobysoft_mirror.sh on packages.jaia.tech to pull the new staging mirror for this release branch.
- Update `jaiabot/.circleci/config.yml`:
	-  Change to new release branch to "filter-template-master-only" and "filter-template-non-master" list.
	-  Change distros targeted by this release branch.
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
