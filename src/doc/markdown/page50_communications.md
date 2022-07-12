# Communications

## XBee

The XBee radios (Digi XBee PRO S3B Radio) act as wireless serial ports in their default "transparent" mode. In this mode, they are essentially a Hayes modem with a predefined single endpoint that they are connected to whenever not in Command (AT) mode.

See this document for the AT commands:

- <https://www.digi.com/resources/documentation/Digidocs/90002173/#containers/cont_at_cmds.htm?TocPath=AT%2520commands%257C_____0>

Quick setup from default configuration (arbitrarily using ID 7):

```
picocom /dev/serial/by-id/usb-FTDI_FT231X_USB_UART_DN0404TP-if00-port0 -b 9600
```

(I found CTRL+A, CTRL+C which enables local echo to be helpful)

Then send:

```
+++
# Should respond with OK
AT
# Should respond with OK
ATID=7
# Should respond with 7
ATWR
# Should respond with OK
```

It appears that the channel (CM), preamble ID (HP) and network ID all need to match to allow the radios to communicate.

### Testing

Local testing (no Xbee)

```
socat pty,link=/tmp/ttyxbee0,raw,echo=0 pty,link=/tmp/ttyxbee1,raw,echo=0
```

Running the code on the dev machine but using the radios (using socat to forward the serial links from the jaiabots):

```
# jaiabot1
socat file:/dev/serial/by-id/usb-FTDI_FT231X_USB_UART_DN0404TU-if00-port0,b9600,raw,echo=0 tcp-l:50000
# jaiabot2
socat file:/dev/serial/by-id/usb-FTDI_FT231X_USB_UART_DN0404TP-if00-port0,b9600,raw,echo=0 tcp-l:50000
# dev machine
socat tcp:172.20.11.11:50000 pty,link=/tmp/ttyxbee0,raw,echo=0
socat tcp:172.20.11.12:50000 pty,link=/tmp/ttyxbee1,raw,echo=0
```

