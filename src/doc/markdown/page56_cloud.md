# Cloud Computing

The Jaia Cloud is designed to provide:
- remote access to simulated fleets (intended to be a nearly identical "digital twin" of the corresponding real fleet, if one exists) for user training and scenario planning.
- remote mission planning and control of real fleets over the internet.
- remote access to data storage, analysis and visualization.

![](../figures/jaia-fleet-in-the-cloud.png)

## Definitions

- Cloud - remote internet-connected on-demand computing provided (in this case) by Amazon Web Services (AWS) on the Elastic Compute Cloud (EC2) virtual machine system.
- VirtualFleet -  a set of VirtualBots and VirtualHubs that run in the cloud on virtual machines.
- VirtualBot - an amd64 version of the real bot that differs in that all the sensors/actuation are hooked up to simulators rather than the real hardware.
- VirtualHub - Similar to VirtualBot, just for a hub.
- CloudHub - Essentially a "copy" (or secondary hub) of the real fleet's hub (or primary hub) that lives in the cloud rather than in the physical hub hardware. This can send commands / receive data from the real fleet efficiently. 


## Network addresses

The use of the `ip.py` tool (in `jaiabot/config/gen`) is recommended for determining IP addresses for a given node, id, fleet, etc.

The network address assignment for the Jaia Cloud is intended to complement the existing fleet specific [VPN](page55_vpn.md). This means that a given fleet may have up to three VPN subnets assigned:

1. "fleet VPN": The fleet VPN for remote support (vpn.jaia.tech) - UDP port 51821 + fleet ID
2. "virtualfleet VPN": The virtual fleet VPN for access to the "digital twin" virtual fleet - UDP port 51820
3. "cloudhub VPN": The data offload / remote control VPN for access to the real fleet from the CloudHub - UDP port 51821

These all need to be different because:

- The customer may choose the host both the virtualfleet and cloudhub VPN on their own (secure) AWS account and not provide Jaia access.
- Some customers will not have a VirtualFleet at all.
- Some customers may want to restrict access to the Cloudhub to a different set of users than those who have access to the VirtualFleet (e.g., trainees not able to accidentally command real fleet).

Additionally, each VPC has three subnets assigned:

1. CloudHub Subnet: 10.23.255.0/24 and 2001:db8:0:**0**::/64 where 2001:db8::/56 is replaced by the Amazon EC2 assigned IPv6 block for the VPC.
2. VirtualFleet ETH0 Subnet: 10.23.254.0/24 and 2001:db8:0:**1**::/64 where 2001:db8::/56 is replaced by the Amazon EC2 assigned IPv6 block for the VPC.
3. VirtualFleet WLAN Subnet: 10.23.{flt}.0/24 and 2001:db8:0:**2**::/64 where 2001:db8::/56 is replaced by the Amazon EC2 assigned IPv6 block for the VPC.

### IPv4 

1. Fleet VPN: The IPv4 addresses remain as assigned in [VPN](page55_vpn.md) document: 172.23.flt.bot_or_hub, where flt = Fleet ID, bot_or_hub = 10 + hub ID or 100 + bot ID.
2. VirtualFleet VPN / CloudHub VPN: No IPv4 addresses are assigned except for the VPN server itself (to allow connections from IPv4 only customers).

### IPv6 

#### Prefix

The prefix is `fd00::/8` for unique local addresses as defined in [RFC4193](https://www.rfc-editor.org/rfc/rfc4193.html).

The full 48-bit prefix was (pseudo)-randomly generated as per RFC4193 for each of the three VPN classes.

| VPN Class        | IPv6 Prefix             |
|------------------|-------------------------|
| Fleet VPN        | `fd91:5457:1e5c::/48`   |
| VirtualFleet VPN | `fd6e:cf0d:aefa::/48`   |
| CloudHub VPN     | `fd0f:77ac:4fdf::/48`   |
| Physical WLAN    | `fddd:7f2e:3258::/48`   |

#### Subnet 

For each VPN class, the Subnet ID is the Fleet ID, so for example, VirtualFleet 3 would have the subnet `fd6e:cf0d:aefa:3::/64`. This allows up to 2^16 = 65536 fleets to be assigned.

#### Address

For a given node (bot or hub) on the VPN, the 64-bit interface identifier is given as `::0:hub_id` for hubs, `::1:bot_id` for bots, and `::2:customer_id` for various customer machines (desktop / laptop / tablet). This allows up to 2^16 = 65536 bots and hubs to be assigned per fleet.

Some examples include:

| Fleet     | Bot or Hub? | ID  | Fleet VPN Address  |  VirtualFleet VPN Address  |  CloudHub VPN Address  |
|-----------|-------------|-----|--------------------|--------------------|--------------------|
| 4        | Bot         | 5   | `fd91:5457:1e5c:4::1:5` | `fd6e:cf0d:aefa:4::1:5` | `fd0f:77ac:4fdf:4::1:5` |
| 3001      | Bot         | 6   | `fd91:5457:1e5c:bb9::1:6` | `fd6e:cf0d:aefa:bb9::1:6` | `fd0f:77ac:4fdf:bb9::1:6` |
| 235       | Hub         | 574 | `fd91:5457:1e5c:eb::0:23e` | `fd6e:cf0d:aefa:eb::0:23e` | `fd0f:77ac:4fdf:eb::0:23e` |


## AWS tags

### AMI

- Name: jaiabot__rootfs-feature_aws-cloud-v1.0.0~alpha1+93+g66c96e1__code-v1.7.0
- jaiabot-rootfs-gen_version: 1.0.0~alpha1+93+g66c96e1
- jaiabot-rootfs-gen_repository: release
- jaiabot-rootfs-gen_repository_version: 1.y
- jaiabot-rootfs-gen_build-date: Fri 08 Dec 2023 02:20:27 UTC
- jaiabot-rootfs-gen_build-unixtime: 1702002064

### VPC components (including Instances)
- Name: jaia__COMPONENT__CUSTOMER_NAME: COMPONENT is VPC, Subnet, SecurityGroup, etc.
- jaia_customer: CUSTOMER_NAME
- jaiabot-rootfs-gen_repository: same as AMI
- jaiabot-rootfs-gen_repository_version: same as AMI.
- jaia_fleet: Fleet ID


### VM Instances

- Name: jaia__CloudHub_VM__CUSTOMER_NAME, jaia__VirtualHubN_VM__CUSTOMER_NAME, or jaia__VirtualBotN_VM__CUSTOMER_NAME
- jaia_instance_type: cloudhub, virtualfleet
