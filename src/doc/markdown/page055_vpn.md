# VPN Setup

*This section written by Claude*

From release 3, each fleet's VPN is served by its own CloudHub. Its bots and hubs pair with the CloudHub (see "Enrolling a node at first boot" below) and reach it, and through it the fleet's other hubs, over `wg_jaia_ch<fleet>`. Addressing on it is in [Cloud Computing](page056_cloud.md). `vpn.jaia.tech` no longer enrolls a fleet's nodes; what follows on it is kept for servicing release 2 fleets.

We use a VPN to securely connect to the JaiaBots for development and testing.

## Wireguard

[Wireguard](https://www.wireguard.com/) is a simple and fast modern VPN. By using a VPN to send traffic between the jaiabots and various dev machines, we can easily connect behind NAT routers and provide a secure virtual LAN.

### Server

We're using AWS EC2 for hosting the server; other providers will likely be similar.

I used the standard Ubuntu 20.04 server image (`Ubuntu Server 20.04 LTS (HVM), SSD Volume Type - ami-03d5c68bab01f3496 (64-bit x86)`) in EC2, using a t3.micro instance type with 8GB disk space. I associated the Elastic IP address 52.36.157.57 (which has been assigned the domain name of `vpn.jaia.tech`) to the machine.

On a server (e.g. cloud machine), we configure:

- Install wireguard:

      sudo apt install wireguard

- Generate the server key pair:

      sudo -i
      cd /etc/wireguard
      umask 077; wg genkey | tee privatekey | wg pubkey > publickey

- Create `/etc/wireguard/wg_jaia.conf`:

      [Interface]
      
      # VPN Address for server
      Address = 172.20.11.1/24
      
      # VPN Server Port
      ListenPort = 51820
      
      # PrivateKey (contents of /etc/wireguard/privatekey)
      PrivateKey = ...
      
      # Note that this configuration uses NAT to make the VPN traffic appear to the rest of the Virtual Private Cloud (VPC) as if its coming from the VPN instance; this avoids the need for disabling the source/destination check or updating routing tables in EC2.
      # update eth0 to the actual internet interface
      PostUp = iptables -w 60 -A FORWARD -i wg_jaia -j ACCEPT; iptables -w 60 -t nat -A POSTROUTING -o eth0 -j MASQUERADE
      PostDown = iptables -w 60 -D FORWARD -i wg_jaia -j ACCEPT; iptables -w 60 -t nat -D POSTROUTING -o eth0 -j MASQUERADE


- Allow firewall on inbound UDP port 51820 (both UFW if installed and cloud provider firewall rules):

      sudo ufw allow 51820/udp

- Enable the systemd service to start the wireguard server on start:

      sudo systemctl enable wg-quick@wg_jaia

- Start it (or reboot):

      sudo systemctl start wg-quick@wg_jaia

- Verify that there's a `wg_jaia` interface:

      sudo wg
      sudo ip a show wg_jaia

- Enable IP forwarding so that machines on the VPN can see each other "through" the server by editing `/etc/sysctl.conf` and then reboot (or `sysctl -p`):

      net.ipv4.ip_forward = 1

### Client

On the client (jaiabot, dev machines, etc.) side, we need to configure:

- Install wireguard:

      sudo apt install wireguard

- Generate the client key pair:

      sudo -i
      cd /etc/wireguard/
      umask 077; wg genkey | tee privatekey | wg pubkey > publickey

- Create `/etc/wireguard/wg_jaia.conf`:

      [Interface]
      # from /etc/wireguard/privatekey on client
      PrivateKey = ...
        
      # this client's VPN IP address
      Address = 172.20.11.XXX
        
      [Peer]
      # Server public key (from /etc/wireguard/publickey on server)
      PublicKey =  quIp0ErbKXgzbws0juC0YaI2FLmLHVpo8j4ChgTmjXI=
      # Allowed private IPs
      AllowedIPs = 172.20.11.0/24
        
      # Server IP and port
      Endpoint = vpn.jaia.tech:51820
        
      # Keep connection alive (required for behind NAT routers)
      PersistentKeepalive = 25

  

- Add the client information to the **server's** `/etc/wireguard/wg_jaia.conf`:

      [Peer]
      # client VPN public key (from /etc/wireguard/publickey on client)
      PublicKey = ...
        
      # client VPN IP address
      AllowedIPs = 172.20.11.XXX/32

- Restart the **server** Wireguard:

      sudo systemctl restart wg-quick@wg_jaia

- Start the client Wireguard:

      sudo wg-quick up wg_jaia

- Check that you can ping the server:

      ping 172.20.11.1

- (optional) - have the client connect on boot:

      sudo systemctl enable wg-quick@wg_jaia


### Client - MacOS (Optional)

MacOS has a GUI wireguard that requires a slightly different approach summarized below
- Open manage wireguard tunnels
- click plus
- add empty tunnel
- type in a name
- paste the contents of the .conf above except for the interface private key part
- replace the xxx with your IP address
- click save
- follow the steps above to add your public key to the server


### Fleet specific VPNs

We are rolling out fleet specific VPN connections that follow this pattern:

- Server: `vpn.jaia.tech`, UDP port `51821 + fleet id` (e.g. `51821` for fleet 0, `51822` for fleet 1, etc.). 
- Subnet: `172.23.xxx.0/24` where xxx is the fleet id. The server will always be `172.23.xxx.1`.
- Bot address: `172.23.xxx.yyy/24` where xxx is the fleet id, and yyy is 100 + bot_id (e.g. `172.23.1.101` for bot 1 on fleet 1).
- Hub address: `172.23.xxx.zzz/24` where xxx is the fleet id, and zzz is 10 + hub_id (e.g. `172.23.2.10` for hub 0 on fleet 2).

This IPv4 addressing covers fleets 0-250, which is as many as the single octet holds. Fleets above that are addressed on `fd91:5457:1e5c:{fleet id}::/64` instead, following the same scheme as the other VPNs; see [Cloud Computing](page056_cloud.md) for the fleet id ranges. The server port stays `51821 + fleet id` for every fleet, which the current range of fleet ids fits: it reaches 55821 at fleet 4000, and does not run out of port numbers until fleet 13714.

The existing VPN on vpn.jaia.tech:51820 (subnet `172.20.11.0/24`) will continue to be maintained for testing.

These addresses are computed by `jaiabot::ipv4_addr`/`jaiabot::ipv6_addr` (`src/lib/utils/ip.h`) and can be queried with `jaia ip` / `jaia_ip` (see the [Jaia Tool](page005_jaia_tool.md) page). The client and server Wireguard configurations for the fleet, VirtualFleet and CloudHub VPNs are generated by `jaia-vpn-gen.sh` (`src/sh/utils/jaia-vpn-gen.sh`).

A node keeps its own private key. Generate it on the node being added:

```
umask 077; wg genkey | sudo tee /etc/wireguard/privatekey | wg pubkey
```

and give that public key to the server:

```
jaia admin vpn cloudhub_vpn bot 3 <public key>
```

The config it writes carries no private key, so it can be copied to the node by any means; the node then puts its own key into it, as the command's output says. `fleet_vpn` may still be run without a public key, because the server it runs on does not take `jaia-vpn-gen.sh` from this package and so cannot be assumed to accept one; it warns when it generates a key on the node's behalf.

### Enrolling a node at first boot

A bot or hub enrolls with its own fleet's CloudHub rather than `vpn.jaia.tech`:
`/etc/jaiabot/init/pair-with-cloudhub.sh` generates the node's key
pair, hands the public half to the CloudHub over SSH, and writes the config that
comes back to `/etc/wireguard/wg_jaia_ch<fleet>.conf` with its own private key in
it. `jaia admin fleet generate` puts the CloudHub's base URI in the preseed, and
leaves the step out for the CloudHub itself and for a fleet that has none.

Before it pairs, the node waits up to two minutes (`JAIA_PAIRING_WAIT_SECONDS`)
for a TCP connection to the CloudHub's HTTPS port, which answers whether or not
pairing is open; no ping is needed, so networks that block ICMP still pair. A
node that cannot reach the CloudHub, or that the CloudHub turns away because
fleet pairing is closed, keeps its bootstrap key and says which in its log; run
"Pair Fleet to CloudHub" once pairing is open to try again.

The SSH key it uses (`id_vpn_tmp`) is on the boot media of every node in the
fleet, so on the CloudHub it is authorized with `restrict`, an expiry, and
`command="/usr/bin/jaia-vpn-enroll.sh"`. That forced command
(`src/sh/utils/jaia-vpn-enroll.sh`) reads one request of the form
`bot|hub <node id> <public key>`, enrolls that node, and prints its config: the
key buys a peer entry on `wg_cloudhub` and nothing else - no shell, no other
interface, and no way to read what another node was given. A re-imaged node
comes back with a new key, so enrolling one that is already a peer replaces it.

*This section written by Claude*

That entry exists only while **fleet pairing** is open. A CloudHub is built with
pairing closed, keeping the fleet's bootstrap public key for later; pairing is opened
for a set time - at most two weeks - from **Open Fleet Pairing** in the JCU's Fleet
Changes, and closes itself. While it is open, `jaia-support-access.py` on the
CloudHub writes the entry through `jaia-vpn-authorize.sh`, so it has one author, and
opens port 22 at the security group to every address, since a node enrolls over SSH
from wherever it is. The entry is rewritten on every run of the CloudHub's reconcile
timer from a record in its persistent support directory, so it survives a reboot and
ends when pairing does; the expiry it carries is a full UTC timestamp, since sshd reads
a bare date as midnight at the start of that day. It leaves the temporary keys of
whoever `jaia admin ssh add` has let into the same file alone.

**Pair Fleet to CloudHub**, run from a hub on site, re-runs enrollment on every bot
and hub over the fleet WLAN. A node remembers the CloudHub it was given at first boot,
so the re-run needs no argument; one already paired is left as it is.

A node whose enrollment is refused keeps `id_vpn_tmp` in `/home/jaia/.ssh`, so
once fleet pairing is open again **Pair Fleet to CloudHub** picks it up rather than
it having to be re-imaged. The key is deleted only once a config has been installed.

*This section written by Claude*

### Starting at boot

Whether a node's tunnel starts by itself at boot is the fleet configuration's
`service_vpn_enabled`, and nothing else: enrollment happens whenever the fleet has a
CloudHub, and leaves the tunnel stopped on a node set not to start it. On site, the
JCU's **Change CloudHub VPN State** starts, stops, enables or disables it on the hub,
and **Check CloudHub VPN Status** reports both. The hub-to-hub link (HUB2HUB) runs
through the CloudHub, so a hub whose tunnel is down loses it.

### After a major upgrade

A major upgrade carries no node's enrollment over, only the CloudHub's own
`/etc/wireguard`, so afterwards the fleet is paired again as a new fleet would be
(see [Major software upgrade](page091_major_upgrade.md)).
