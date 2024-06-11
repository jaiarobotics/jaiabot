# Cloud Computing

The Jaia Cloud is designed to provide:
- VirtualFleet: remote access to simulated fleets (intended to be a nearly identical "digital twin" of the corresponding real fleet, if one exists) for user training and scenario planning.
- CloudHub: 
	- remote mission planning and control of real fleets over the internet.
	- remote access to data storage, analysis and visualization.
	- control (start/stop/delete/create) of VirtualFleet

It is possible to have a VirtualFleet without a corresponding real fleet or vice-versa. 

![](../figures/jaia-fleet-in-the-cloud.png)


## Definitions

### Jaia Terms
- Cloud - remote internet-connected on-demand computing provided (in this case) by Amazon Web Services (AWS) on the Elastic Compute Cloud (EC2) virtual machine system.
- CloudHub - Essentially a "copy" (or secondary hub) of the real fleet's hub (or primary hub) that lives in the cloud rather than in the physical hub hardware. This can send commands / receive data from the real fleet efficiently. It is also used to manage the VirtualFleet. This machine is always-on. CloudHub uses the Hub ID 30 with a given fleet.
- VirtualFleet -  a set of VirtualBots and VirtualHubs that run in the cloud on virtual machines.
- VirtualBot - an amd64 version of the real bot that differs in that all the sensors/actuation are hooked up to simulators rather than the real hardware.
- VirtualHub - Similar to VirtualBot, just for a hub.

### Amazon Web Services (AWS) Terms

- EC2 - Elastic Compute Cloud: AWS's Virtual Machine infrastructure.
- S3 - Simple Storage Service: AWS's data storage in the cloud with variable access latencies and corresponding costs.
- VPC - Virtual Private Cloud: a collection of networking components (subnets, internet gateways, firewall rules, etc) in an isolated environment from other VPCs that might exist in Jaia's or a customer's EC2 account for a given region.

## Architecture

Each VPC has one and only one fleet. At a minimum this is a CloudHub machine, which is always on.


### VPC 

The components of the VPC include:

- Subnets:
	+ jaia__Subnet_CloudHub: A subnet for Cloudhub alone.
	+ jaia__Subnet_VirtualFleet_WLAN: A subnet for the VirtualFleet (uses the same private IP addresses as the real fleet's wireless LAN.
- Route tables:
	+ jaia__RouteTable: A simple routing table that sends all non LAN traffic to the internet gateway.
- Internet gateway:
	+ jaia__InternetGateway: A simple internet gateway with default configuration.
- Elastic IPs:
	+ jaia__CloudHub_VM__ElasticIP: A public IPv4 address for access to CloudHub.
- Security Groups (Firewalls):
	+ jaia__SecurityGroup_CloudHub: Allows access to VPNs only running on CloudHub.
	+ jaia__SecurityGroup_VirtualFleet: Allows access only within private network (jaia__Subnet_VirtualFleet_WLAN).
- Instances (Virtual Machines):
	+ CloudHub
		* CloudHub VPN
		* VirtualFleet VPN
	+ (optionally) VirtualHub1
	+ (optionally) VirtualBot1-N

## Network addresses

The use of the `ip.py` tool (in `jaiabot/rootfs/customization/includes.chroot/etc/jaiabot` or `/etc/jaiabot/ip.py` on the hub/bots) is recommended for determining IP addresses for a given node, id, fleet, etc.

The network address assignment for the Jaia Cloud is intended to complement the existing fleet specific [VPN](page55_vpn.md). This means that a given fleet may have up to three VPN subnets assigned:

1. Real "fleet VPN": The fleet VPN for remote support (vpn.jaia.tech) - UDP port 51821 + fleet ID. Managed by vpn.jaia.tech.
2. "VirtualFleet VPN": The virtual fleet VPN for access to the "digital twin" virtual fleet - UDP port 51820. Managed by the fleet's CloudHub.
3. "cloudhub VPN": The data offload / remote control VPN for access to the real fleet from the CloudHub - UDP port 51821. Managed by the fleet's CloudHub.

These all need to be different because:

- The customer may choose the host both the virtualfleet and cloudhub VPN on their own (secure) AWS account and not provide Jaia access.
- Some customers will not have a VirtualFleet at all.
- Some customers may want to restrict access to the Cloudhub to a different set of users than those who have access to the VirtualFleet (e.g., trainees not able to accidentally command real fleet).

Additionally, each VPC has two subnets assigned as previously mentioned:

1. CloudHub Subnet: 10.23.255.0/24 and 2001:db8:0:**0**::/64 where 2001:db8::/56 is replaced by the Amazon EC2 assigned IPv6 block for the VPC.
2. VirtualFleet WLAN Subnet: 10.23.{flt}.0/24 and 2001:db8:0:**2**::/64 where 2001:db8::/56 is replaced by the Amazon EC2 assigned IPv6 block for the VPC.

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
| 250      | Bot         | 6   | `fd91:5457:1e5c:fa::1:6` | `fd6e:cf0d:aefa:fa::1:6` | `fd0f:77ac:4fdf:fa::1:6` |
| 10       | Hub         | 20 | `fd91:5457:1e5c:a::14` | `fd6e:cf0d:aefa:a::14` | `fd0f:77ac:4fdf:a::14` |
| 15       | Hub (CloudHub)        | 30 | `fd91:5457:1e5c:f::1e` | `ffd6e:cf0d:aefa:f::1e` | `fd0f:77ac:4fdf:f::1e` |

You can generate the values for the table above yourself using:
```
ip.py addr --fleet_id 4 --node bot --node_id 5 --net fleet_vpn --ipv6
ip.py addr --fleet_id 4 --node bot --node_id 5 --net vfleet_vpn --ipv6
ip.py addr --fleet_id 4 --node bot --node_id 5 --net cloudhub_vpn --ipv6

ip.py addr --fleet_id 250 --node bot --node_id 6 --net fleet_vpn --ipv6
ip.py addr --fleet_id 250 --node bot --node_id 6 --net vfleet_vpn --ipv6
ip.py addr --fleet_id 250 --node bot --node_id 6 --net cloudhub_vpn --ipv6

ip.py addr --fleet_id 10 --node hub --node_id 20 --net fleet_vpn --ipv6
ip.py addr --fleet_id 10 --node hub --node_id 20 --net vfleet_vpn --ipv6
ip.py addr --fleet_id 10 --node hub --node_id 20 --net cloudhub_vpn --ipv6

ip.py addr --fleet_id 15 --node hub --node_id 30 --net fleet_vpn --ipv6
ip.py addr --fleet_id 15 --node hub --node_id 30 --net vfleet_vpn --ipv6
ip.py addr --fleet_id 15 --node hub --node_id 30 --net cloudhub_vpn --ipv6
```

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

- all:
	- Name: jaia__CloudHub_VM__CUSTOMER_NAME, jaia__VirtualHubN_VM__CUSTOMER_NAME, or jaia__VirtualBotN_VM__CUSTOMER_NAME
	- jaia_instance_type: cloudhub, virtualfleet
- VirtualBot/VirtualHub:
	+ jaia_node_id: Bot ID or Hub ID
	+ jaia_node_type: "bot" or "hub"

## Usage

Once connected to the appropriate VPN and hosts are configured in `/etc/hosts`, one can open a web-browser as usual to JCC, etc.

For fleet1, these would be:
```
# /etc/hosts
fd6e:cf0d:aefa:2::1 hub1-virtualfleet1
fd0f:77ac:4fdf:2::1e cloudhub-fleet1
```

- http://cloudhub-fleet1 for CloudHub JCC (remote command and monitoring of real fleet).
- http://cloudhub-fleet1:9091 for CloudHub Jaiabot Fleet Upgrade and Configuration (for updating CloudHub itself, starting/stopping of the VirtualFleet).
- http://hub1-virtualfleet1 for the VirtualFleet JCC (command and monitoring of Virtual Fleet).
- http://hub1-virtualfleet1:9091 for the VirtualFleet Jaiabot Fleet Upgrade and Configuration (for updating the VirtualFleet).