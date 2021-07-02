# VPN Setup

We use a VPN to securely connect to the Jaiabots for development and testing.

## Wireguard

[Wireguard](https://www.wireguard.com/) is a simple and fast modern VPN. By using a VPN to send traffic between the jaiabots and various dev machines, we can easily connect behind NAT routers and provide a secure virtual LAN.

### Address summary

We're using the private subnet 172.20.11.0/24:

- Server: 172.20.11.1
- jaiabot0: 172.20.11.10
- jaiabot1: 172.20.11.11
- @tsaubergine dev computer: 172.20.11.240

### Server

We're using AWS EC2 for hosting the server; other providers will likely be similar.

I used the standard Ubuntu 20.04 server image (`Ubuntu Server 20.04 LTS (HVM), SSD Volume Type - ami-03d5c68bab01f3496 (64-bit x86)`) in EC2, using a t3.micro instance type with 8GB disk space. I associated the Elastic IP address 52.36.157.57 to the machine.

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
        PostUp = iptables -A FORWARD -i wg_jaia -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
        PostDown = iptables -D FORWARD -i wg_jaia -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE


- Allow firewall on inbound UDP port 51820 (both UFW if installed and cloud provider firewall rules):

        sudo ufw allow 51820/udp

- Enable the systemd service to start the wireguard server on start:

        sudo systemctl enable wg-quick@wg_jaia

- Start it (or reboot):

        sudo systemctl start wg-quick@wg_jaia

- Verify that there's a `wg_jaia` interface:

        sudo wg
        sudo ip a show wg_jaia

- Enable IP forwarding so that machines on the VPN can see each other "through" the server:

        sysctl -w net.ipv4.ip_forward=1

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
        
        # this client's IP address
        Address = 172.20.11.10
        
        [Peer]
        # Server public key (from /etc/wireguard/publickey on server)
        PublicKey =  quIp0ErbKXgzbws0juC0YaI2FLmLHVpo8j4ChgTmjXI=
        # Allowed private IPs
        AllowedIPs = 172.20.11.0/24
        
        # Server IP and port
        Endpoint = vpn.jaia.tech:51820
        
        # Keep connection alive (required for behind NAT routers)
        PersistentKeepalive = 25

Add the client information to the server's `/etc/wireguard/wg_jaia.conf`:

        [Peer]
        # client VPN public key (from /etc/wireguard/publickey on client)
        PublicKey = ...
        
        # client VPN IP address
        AllowedIPs = 192.168.11.10/32

- Restart the **server** Wireguard:

        sudo systemctl restart wg-quick@wg_jaia

- Start the client Wireguard:

        sudo wg-quick start wg_jaia

- Check that you can ping the server:

        ping 172.20.11.1

- (optional) - have the client connect on boot:

        sudo systemctl enable wg-quick@wg_jaia
