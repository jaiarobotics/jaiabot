import serial
import time

from enum import Enum

# Usage: python3 payload_board_test.py

# By default, the script is looking for the board to be connected via UART_2 
# on the sensor card (/dev/ttyAMA5). 

### Globals ###
serial_port = serial.Serial('/dev/ttyAMA5', 40000, timeout=1)
write_buffer = [0]


### Enums ###
class NRLconstant(Enum):
    NRL_SYNC1 = 0xAA
    NRL_SYNC2 = 0xBB

class commState(Enum):
    COMS_FIND_SYNC = 0
    COMS_FIND_LENGTH = 1
    COMS_FIND_MESSAGE = 2
    COMS_FIND_CSA = 3
    COMS_FIND_CSB = 4

class commandIDs(Enum):
    START = 'B'
    STOP = 'C'


class messageData:
    def __init__(self):
        self.sync1 = 0
        self.sync2 = 0
        self.length = 0
        self.payload = bytearray(256)  # Pre-allocate buffer
        self.idx = 0
        self.pA = 0
        self.pB = 0
        self.commandID = 'Z'
        self.type = 0
        self.checksum = False
        self.timestep = 0


def accumComsCsum(num: int, message: messageData):
    message.pA += num
    message.pB += message.pA


# For now, I'm manually assembling the packet
# This is different from the way that it was done in the original code
# Note: the payload includes two checksum bytes
def assemble_nrl_coms_packet(msgPacket: bytearray, data: str, numBytes: int) -> int:
    pA = 0
    pB = 0

    msgPacket[0] = NRLconstant.NRL_SYNC1.value
    msgPacket[1] = NRLconstant.NRL_SYNC2.value
    msgPacket[2] = numBytes

    if numBytes > 0:
        for i in range(numBytes):
            msgPacket[i+3] = ord(data[i]) if isinstance(data, str) else data[i]
            

    for i in range(numBytes + 3):
        pA += msgPacket[i]
        pB += pA

    msgPacket[numBytes + 3] = pA & 0xFF
    msgPacket[numBytes + 4] = pB & 0xFF

    return numBytes + 5


# USB only.  For TCP/IP implementation, see CICADA_v130 software.
# Return 0 on success.  Return -2 on error: wrong number of bytes sent.  Return -1 if numWrite = 0.
# The address is the Jaia Payload to send data to.  Not currently used; it's a broadcast to everything at the moment.
def wireless_tx_only(comPort: serial.Serial, address: int, numWrite: int, writeData: str) -> int:
    length = 0
    temp = 0
    jaiaPacket = bytearray(numWrite + 5)

    if numWrite == 0:
        return -1

    length = assemble_nrl_coms_packet(jaiaPacket, writeData, numWrite)

    temp = comPort.write(jaiaPacket[:length])
    if temp != length:
        return -2

    return 0


# This is based on Aaron Khan's common coms method
# However, I had to modify it to work in Java.  
# Try to make it work like a state machine, if possible.
# The Comm Thread is a separate independent thread so that it can filter out all of the packets that are not associated with the Jaia payload.
# For the Jaia sensor project, this function reads a single byte at a time
# This is probably OK at slower baud rates
# Return values for Jaia sensor:
# 0 = success
# -1 = empty packet

#Basically a receiver function that reads a single byte at a time from the payload board
def wireless_rx_only(comPort: serial.Serial, cs: commState, message: messageData, startData: int) -> commState:
    temp = startData
    while temp > 0: 
        byte_read = comPort.read(1)
        if len(byte_read) == 0: 
            return cs

        byte_val = byte_read[0]  # Get integer value from bytes

        if cs == commState.COMS_FIND_SYNC:
            message.sync1 = message.sync2
            message.sync2 = byte_val
            if ((message.sync1 == NRLconstant.NRL_SYNC1.value) and (message.sync2 == NRLconstant.NRL_SYNC2.value)):
                message.pA = 0
                message.pB = 0
                message.idx = 0
                message.commandID = 'Z'
                message.type = 0
                message.timestep = 0
                cs = commState.COMS_FIND_LENGTH
                
                accumComsCsum(message.sync1, message)
                accumComsCsum(message.sync2, message)

        elif cs == commState.COMS_FIND_LENGTH:
            message.length = byte_val
            accumComsCsum(message.length, message)
            if (message.length > 0):
                cs = commState.COMS_FIND_MESSAGE
            else:
                cs = commState.COMS_FIND_CSA

            message.idx = 0
            message.timestep = 0

        elif cs == commState.COMS_FIND_MESSAGE:
            message.payload[message.idx] = byte_val
            accumComsCsum(message.payload[message.idx], message)

            if message.idx == 0:
                message.commandID = chr(message.payload[message.idx])
            elif message.idx == 1:
                message.type = message.payload[message.idx]
            elif message.idx == 2:
                message.timestep = message.payload[message.idx]
                
            message.idx += 1
            if message.idx == message.length:
                cs = commState.COMS_FIND_CSA

        elif cs == commState.COMS_FIND_CSA:
            if message.pA & 0xFF == byte_val:
                message.checksum = True
            else:
                message.checksum = False
            cs = commState.COMS_FIND_CSB
        
        elif cs == commState.COMS_FIND_CSB:
            if (message.pB & 0xFF) != byte_val:
                message.checksum = False
            cs = commState.COMS_FIND_SYNC
        
        else:
            cs = commState.COMS_FIND_SYNC

        temp = comPort.in_waiting

    return cs


def toggle_instrument(toggled: bool):
    if toggled:
        wireless_tx_only(serial_port, 0, 1, commandIDs.STOP.value) # Stop taking samples
    else:
        wireless_tx_only(serial_port, 0, 1, commandIDs.START.value) # Start taking samples


def main():
    # Toggle the instrument on and off
    timer = 0
    toggled = False
    message = messageData()  # Create instance once
    cs = commState.COMS_FIND_SYNC
    
    while True:
        timer += 1
        if timer > 100:
            toggle_instrument(toggled)
            toggled = not toggled
            timer = 0  # Reset timer
        
        ### Uncomment this to print received commands to the terminal
        # cs = wireless_rx_only(serial_port, cs, message, serial_port.in_waiting)
        # if message.checksum and message.commandID != 'Z':
        #     print(f"Received command: {message.commandID}, type: {message.type}, timestep: {message.timestep}")


if __name__ == "__main__":
    main()