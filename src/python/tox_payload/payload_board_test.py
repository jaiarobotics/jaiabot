# Usage: python3 payload_board_test.py

# By default, the script is looking for the board to be connected via UART_2 
# on the sensor card (/dev/tty







import serial
import time

serial_port = serial.Serial('/dev/ttyAMA', 40000, timeout=1)

write_buffer = [0]

NRL_SYNC1 = 0xAA
NRL_SYNC2 = 0xBB


# For now, I'm manually assembling the packet
# This is different from the way that it was done in the original code
# Note: the payload includes two checksum bytes
def assemble_nrl_coms_packet(msgPacket: bytearray, data: bytearray, numBytes: int) -> int:
    pA = 0
    pB = 0

    msgPacket[0] = NRL_SYNC1
    msgPacket[1] = NRL_SYNC2
    msgPacket[2] = numBytes

    if numBytes > 0:
        for i in range(numBytes):
            msgPacket[i+3] = ord(data[i])
            

    for i in range(numBytes + 3):
        pA += msgPacket[i]
        pB += pA

    msgPacket[numBytes + 3] = pA & 0xFF
    msgPacket[numBytes + 4] = pB & 0xFF

    return numBytes + 5


# USB only.  For TCP/IP implementation, see CICADA_v130 software.
# Return 0 on success.  Return -2 on error: wrong number of bytes sent.  Return -1 if numWrite = 0.
# The address is the Jaia Payload to send data to.  Not currently used; it's a broadcast to everything at the moment.
def wireless_tx_only(comPort: serial.Serial, address: int, numWrite: int, writeData: bytearray) -> int:
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


def main():
    start_command = 'B'
    stop_command = 'C'

    # Toggle the instrument on and off
    while True:
        wireless_tx_only(serial_port, 0, 1, start_command) # Start taking samples
        time.sleep(5)
        wireless_tx_only(serial_port, 0, 1, stop_command) # Stop taking samples
        time.sleep(5)


if __name__ == "__main__":
    main()
