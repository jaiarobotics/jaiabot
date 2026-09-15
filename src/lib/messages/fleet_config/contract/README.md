# Fleet config contract snapshots

One `vN/` directory per fleet config version, written by
`scripts/build/fleet-config-contract.py write` and checked by the build:
a frozen copy of `fleet_config.proto` and, for versions whose debconf
questions were still a hand-written file, of `jaiabot-embedded.templates`.
Never edit these, and never change an older version's directory: migrations
are derived from the differences between consecutive snapshots.

See "Fleet configuration versioning" in `src/doc/markdown/page091_major_upgrade.md`.
