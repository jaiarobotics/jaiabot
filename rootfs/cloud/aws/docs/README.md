# Updating docs server (docs.jaia.tech / whatsupdoc.jaia.tech)

## Create new server
```
cd jaiabot/rootfs/cloud/aws
./create_specialty_server.sh docs/docs.conf
```

Test that the new server works on HTTP (http://docs.jaia.tech, http://whatsupdoc.jaia.tech).

## Install HTTPS certificates

```
jaia ssh docs.jaia.tech
sudo certbot --apache
# select 1,2 for both domain names
```

Test that the new server works on HTTPS (https://docs.jaia.tech, https://whatsupdoc.jaia.tech)

## Remove old server

Use the EC2 Console (https://us-west-2.console.aws.amazon.com/ec2/home?region=us-west-2) to terminate the old docs server:

- Change Termination Protection on the old docs server (disable): Actions -> Instance Settings -> Change Termination Protection -> Uncheck box.
- Terminate the instance: Instance State -> Terminate Instance

