# Fleet config versioning

A fleet configuration file (`fleetN.cfg`, a text-format `jaiabot.protobuf.FleetConfig`) is written once when a fleet is created and read again at every major upgrade, possibly years later by a newer release. This page describes how changes to what a fleet config must contain are tracked so that a major upgrade either migrates an older file automatically or fails early with a clear message, rather than silently producing a misconfigured system.

## The contract

What a fleet config must conform to is more than `fleet_config.proto`: the debconf answers it carries (`debconf { key: "jaiabot-embedded/bot_type" value: "pam" }`) are opaque strings to protobuf, so `debian/jaiabot-embedded.templates` is part of the contract too. The contract is:

- every message, field (name, number, label, type, default, deprecation) and enum value reachable from `FleetConfig`, and
- every `jaiabot-embedded/*` debconf question (type, choices, default), except the `debconf_state_*` menu bookkeeping.

`scripts/build/fleet-config-contract.py generate` produces it as normalised JSON. One snapshot per contract version is committed under `src/lib/messages/fleet_config/contract/vN.json`, and `PROJECT_FLEET_CONFIG_VERSION` in `cmake/JaiaVersions.cmake` names the current one. Fleet configs carry the version they were written for in the `version` field; files that predate the field are version 1.

The build also writes the current contract to `share/jaiabot/fleet_config/contract.json`, together with `fleet_config.desc` (a protobuf `FileDescriptorSet`), for tools that need to parse and validate fleet configs without the generated bindings.

## The build-time check

Building `jaiabot_messages` regenerates the contract and compares it with the snapshot for `PROJECT_FLEET_CONFIG_VERSION` (target `fleet_config_contract`; it reruns whenever the proto, the templates, a snapshot or the version changes). The differences are classified and the build fails with instructions unless the two match:

| Change | Classification | What to do |
|---|---|---|
| `optional`/`repeated` field added | compatible | refresh the snapshot |
| enum value added | compatible | refresh the snapshot |
| debconf question added with a `Default:` | compatible | refresh the snapshot |
| debconf choice added, default changed | compatible | refresh the snapshot |
| `required` field added | breaking | prefer `optional` plus a validation rule; otherwise bump and migrate |
| field or enum value marked `[deprecated = true]` | breaking | bump and migrate (the migration clears it) |
| field default changed | breaking | bump and migrate |
| debconf question removed or its type changed | breaking | bump and migrate |
| debconf choice removed or renamed (e.g. `echo` to `pam`) | breaking | bump and migrate (the migration maps values) |
| debconf question added without a `Default:` | breaking | bump and migrate (the migration must supply a value) |
| field, message or enum value removed or renamed; field number, type or label changed | forbidden | undo it: mark the old item `[deprecated = true]` instead |

In text format the field *name* is the wire format, so removing or renaming a field would stop every existing fleet config from parsing. Fields are therefore never deleted, only deprecated, and the check refuses a snapshot history that removes anything - including one where the removal was committed together with a version bump.

### Compatible change

```
fleet-config-contract.py write --proto src/lib/messages/fleet_config.proto \
    --templates debian/jaiabot-embedded.templates \
    --version N --snapshot-dir src/lib/messages/fleet_config/contract
```

where `N` is the current `PROJECT_FLEET_CONFIG_VERSION`. Commit the updated `vN.json`.

### Breaking change

1. Increment `PROJECT_FLEET_CONFIG_VERSION` in `cmake/JaiaVersions.cmake`.
2. Add the migration step from `N` to `N+1` to the fleet config tool. Removed debconf questions are dropped and added ones are written at their template default automatically from the snapshot difference; renames, value mappings (`echo` to `pam`) and anything without a derivable default are written by hand, and a step that cannot produce a valid result must refuse with a message telling the operator what to change or that the fleet config must be regenerated.
3. Write `vN+1.json` with the command above and commit it alongside the previous snapshots, which are never modified.

## Debugging

`fleet-config-contract.py diff old.json new.json` prints the classified differences between any two contract files, and `src/test/fleet_config/test_contract.py` (run by `ctest` with `-Denable_testing=ON`) exercises the classification and the check on the source tree.
