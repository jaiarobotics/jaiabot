## PRE REQS

1. Install construct

```
sudo apt install python3-construct
``` 

2. Install ExtIntEmulator-V25.1.1.3.msi

3. Run Sentinel Externel Interface Emulator

4. Select the Portland_936m recording

5. Click the play button in the top right corner and select Repeat

6. Start the jaia flask server

```
/path/to/jaiabot/src/web/
./run.sh
```

7. Open PowerShell on windows

```
ipconfig
```

8. Get the IP address in the output for Ethernet adapter vEthernet (WSL (Hyper-V firewall))

Ex:

```
Ethernet adapter vEthernet (WSL (Hyper-V firewall)):

   Connection-specific DNS Suffix  . :
   Link-local IPv6 Address . . . . . : fe80::112:f768:aea:3e1d%77
   IPv4 Address. . . . . . . . . . . : 172.24.16.1
   Subnet Mask . . . . . . . . . . . : 255.255.240.0
   Default Gateway . . . . . . . . . :
```

## USAGE

```
source ../../../build/web_dev/python/venv/bin/activate
python3 sentinel_app.py --host 172.24.16.1
```
