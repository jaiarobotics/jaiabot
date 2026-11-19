# Updating docs server (docs.jaia.tech / whatsupdoc.jaia.tech)

The new server is built beside the old one and takes over its addresses, so DNS doesn't change.
`docs.conf` names the server being replaced (`CUTOVER_FROM_INSTANCE_ID`) and the Elastic IP and IPv6 address that move.

## Create new server

```
cd jaiabot/rootfs/cloud/aws
./create_specialty_server.sh docs/docs.conf
```

## Copy the HTTPS certificate across

```
./docs/migrate-from.sh docs/docs.conf <new server's temporary IPv4 address>
```

This copies `/etc/letsencrypt` and the Apache sites from the old server, then runs `docs/check.sh` against the new server, which checks both names over HTTP and HTTPS without changing DNS.

## Cut over

```
./cutover_specialty_server.sh docs/docs.conf
./docs/check.sh 44.248.80.31
jaia ssh docs.jaia.tech sudo certbot renew --dry-run
```

`./cutover_specialty_server.sh --rollback docs/docs.conf` moves the addresses back.

## Remove old server

Stop the old server. After a week or two, set `CUTOVER_FROM_INSTANCE_ID` in `docs.conf` to the new server, then in the EC2 Console (https://us-west-2.console.aws.amazon.com/ec2/home?region=us-west-2):

- Change Termination Protection on the old docs server (disable): Actions -> Instance Settings -> Change Termination Protection -> Uncheck box.
- Terminate the instance: Instance State -> Terminate Instance
- Delete its security group.
