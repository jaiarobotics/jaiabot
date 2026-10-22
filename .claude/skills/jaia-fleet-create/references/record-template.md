# Fleet <N> — build record

| | |
| --- | --- |
| Customer | |
| Base URI | |
| Region / repo / release | |
| Technician | |
| Fleet config | `fleet<N>.cfg` (where it is kept) |

## A. CloudHub

| Step | When | Who | Result / evidence |
| --- | --- | --- | --- |
| Preflight | | Claude | |
| `fleet create`, `validate` | | technician | hubs, bots, start-at-boot yes, comms links |
| `cloudhub create` | | Claude | instance, IPv4, IPv6, AMI |
| DNS records | | technician | provider; `check_dns.sh` passed at |
| Certificates, sites | | Claude | `check_cloudhub.sh` passed at |
| `jaia_bootstrap` claimed | | technician | |
| VirtualFleet (optional) | | technician | left stopped? |
| Every site checked, HUB Cloud in JCC | | technician | |

## B. Nodes

| Node | Image | Boot files | First boot | `check_node.sh` |
| --- | --- | --- | --- | --- |
| hub 1 | | | | |

## C. Pairing

| Step | When | Who | Result / evidence |
| --- | --- | --- | --- |
| Open Fleet Pairing | | technician | open until |
| Pair Fleet to CloudHub | | technician | JCU output |
| Every node `check_node.sh --paired` | | Claude | |
| JCC shows every node | | technician | |
| Close Fleet Pairing | | technician | pairing port closed at |
| `fleet_admin` claimed, `jaia_bootstrap` deleted | | customer | or "later" |

## Left running

AWS: instance, Elastic IPs, VirtualFleet (state). Anything to follow up.

## Changes made by hand

None, or each with when, why and the exact command.
