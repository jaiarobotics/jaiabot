import serial
import time
from datetime import datetime
import csv

s = serial.Serial()
s.port='/dev/ttyS0'
s.baudrate=9600
s.bytesize=serial.EIGHTBITS
s.parity=serial.PARITY_NONE
s.stopbits=serial.STOPBITS_ONE

s.open()
if s.is_open():
    s.write('monitor')

    # Get current time
    current_datetime = datetime.now().strftime("%Y-%m-%d %H-%M-%S")
    str_current_datetime = str(current_datetime)

    filename = str_current_datetime + ".csv"
    with open(filename, "w") as file:
        field_names = ["Conductivity", "Temperature", "Timestamp"]
        writer = csv.DictWriter(file,fieldnames=field_names)
        
        while s.is_open():
            newline = s.readline().split(",")
            print(newline)
            conductivity = newline[0]
            temperature = newline[1]

            writer.writerow({ 'Conductivity': conductivity, 'Temperature': temperature, 'Timestamp': current_datetime })
        


    print(file.name, "created.")
    file.close()


else:
    print("Could not open Serial port.")


s.close()