import serial
#reads from the arduino serial moniter
def rd():
    data = arduino.readline()
    data = data.decode()
    print(data)
arduino = serial.Serial('/etc/jaiabot/dev/arduino', 19200,timeout = .1)
while True:
    rd()