#!/usr/bin/env python3

import serial
import time
import os
import json

#arduino = serial.Serial('/dev/cu.usbserial-1430', 19200,timeout = .1)
arduino = serial.Serial('/etc/jaiabot/dev/arduino', 19200,timeout = .1)

def rd():
    data = arduino.readline()
    return data

def write(command):
    command = str(command)
    command = str(command + "\n")
    arduino.write(bytes(command, 'utf_8'))

def wingInsurance(adjustment):
    x = True
    adjustment = int(adjustment)
    while x is True:
        if adjustment > 500 or adjustment < -500:
            print("this value is too high.")
            adjustment = input("How many microseconds to adjust by? values between -500 and 500 only. ")
        else:
            return str(adjustment)

def inputcommand():
    y = True
    while y is True:
        z = True
        adjustment = input("How many microseconds to adjust by? Values between -500 and 500 only. ")
        adjustment = wingInsurance(adjustment)
        write(adjustment)
        while z is True:
            confirmation = input("is this good? Yes/No ")
            confirmation = confirmation.upper()
            if confirmation == "YES":
                write("Y")
                z = False
                y = False
            elif confirmation == "NO":
                z = False
            else:
                print("Please enter yes or no")

def calibrateWingSurface():
    y = True
    while y == True:
        print("setting lower bound")
        inputcommand()
        print("setting upper bound")
        inputcommand()
        print("setting center")
        inputcommand()

        letitend = True
        while letitend == True:
            finish = input("Would you like to stop calibrating this surface? Yes/No ")
            finish = finish.upper()
            if finish == "YES":

                write("X")

                #formatting the string to be a nice json file
                output = rd()
                output = str(output)
                output = output.replace("b","")
                output = output.replace("'","")
                output = output.replace("/","")
                output = output.replace("r","")
                output = output.replace("\","")
                ourput = output.replace("n","")
                output = output.split()

                #apply bounds to a variable and print them
                port = output[0]
                starboard = output[1]
                center = output[2]
                print(port, starboard, center)

                #dictionary for later
                limits = {"upper":output[0],
                          "lower":output[1],
                          "center":output[2]}

                #releases from the answer loop and ends calibration
                letitend = False
                y = False
                
            elif finish == "NO":

                #releases from the answer loop and restarts calibration
                letitend = False
                write("Z")
                
            else:
                print("Please enter Yes or No")
                
    return limits

def motorInsurance(adjustment, currentSpeed):
    x = True
    while x is True:
        if adjustment + currentSpeed > 160 or adjustment + currentSpeed < 25:
            print("this speed will either stall the motor or is too high. current speed is", currentSpeed)
            print("How many microseconds to adjust by? positive between", 25-currentSpeed, "and", 160-currentSpeed, "only.")
            adjustment = int(input())
        else:
            return adjustment
            

def inputMotorCommand():
    y = True
    currentSpeed = 0
    lastSpeed = 0
    while y is True:
        z = True
        currentSpeed=lastSpeed
        print("How many microseconds to adjust by? positive between", 25-currentSpeed, "and", 160-currentSpeed, "only.")
        adjustment = int(input())
        adjustment = motorInsurance(adjustment, currentSpeed)
        currentSpeed = adjustment+currentSpeed
        write(currentSpeed)
        while z is True:
            confirmation = input("is the motor moving? Yes/No ")
            confirmation = confirmation.upper()
            if confirmation == "YES":
                write("Y")
                x = True
                while x is True:
                    completion = input("ensure you are as close as possible to startup speed before confirming: is this the motor startup speed? Yes/No ")
                    completion = completion.upper()
                    if completion == "YES":
                        write("J")
                        value = rd()
                        z = False
                        y = False
                        x = False
                    elif completion == "NO":
                        write("K")
                        print("your last functional value was", lastSpeed)
                        write(lastSpeed)
                        z = False
                        x = False
                    else:
                        print("Please enter yes or no")
            elif confirmation == "NO":
                lastSpeed = currentSpeed
                write("N")
                z = False
            else:
                print("Please enter yes or no")
                
    value = str(value)
    value = value.replace("b","")
    value = value.replace("'","")
    print(value)
    return value

def inputHaltCommand():
    y = True
    currentSpeed = 0
    lastSpeed = 0
    while y is True:
        z = True
        currentSpeed=lastSpeed
        print("How many microseconds to adjust by? positive between", 25-currentSpeed, "and", 160-currentSpeed, "only.")
        adjustment = int(input())
        adjustment = motorInsurance(adjustment, currentSpeed)
        currentSpeed = adjustment+currentSpeed
        write(currentSpeed)
        while z is True:
            confirmation = input("is the motor stopped? Yes/No ")
            confirmation = confirmation.upper()
            if confirmation == "YES":
                write("Y")
                x = True
                while x is True:
                    completion = input("ensure you are as close as possible to stopping speed before confirming: is this the motor stop speed? Yes/No ")
                    completion = completion.upper()
                    if completion == "YES":
                        write("J")
                        value = rd()
                        z = False
                        y = False
                        x = False
                    elif completion == "NO":
                        write("K")
                        print("your last functional value was", lastSpeed)
                        write(lastSpeed)
                        z = False
                        x = False
                    else:
                        print("Please enter yes or no")
            elif confirmation == "NO":
                lastSpeed = currentSpeed
                write("N")
                z = False
            else:
                print("Please enter yes or no")

    value = str(value)
    value = value.replace("b","")
    value = value.replace("'","")
    print(value)
    return value

def calibrateMotor():
    print("calibrating forward start")
    startup = inputMotorCommand()
    print("calibrating reverse start")
    startdown = inputMotorCommand()
    print("calibrating forward halt")
    haltup = inputHaltCommand()
    print("calibrating reverse halt")
    haltdown = inputHaltCommand()

    letitend = True
    while letitend == True:
        finish = input("Would you like to stop calibrating the motor? Yes/No ")
        finish = finish.upper()
        if finish == "YES":
            motorParameters = {"Forward Start":startup,
                               "Reverse Start":startdown,
                               "Forward Halt":haltup,
                               "Reverse Halt":haltdown}   

            #releases from the answer loop and ends calibration
            letitend = False
            y = False
                
        elif finish == "NO":
            #releases from the answer loop and restarts calibration
            letitend = False
            write("Z")
        else:
            print("Please enter Yes or No")
    return motorParameters

misclick = True
while misclick == True:
    permission = input("would you like to calibrate the jaibot? Yes/No ")
    permission = permission.upper()
    if permission == "YES":
        os.system('cd ~/jaiabot/src/arduino/; ./upload_usb_old.sh JAIABOT_calibration_arduino/')
        #ask the user to calibrate bounds
        StrbBounds = calibrateWingSurface()
        PortBounds = calibrateWingSurface()
        RudderBounds = calibrateWingSurface()
        print("Surface Calibration Complete")
        MotorBounds = calibrateMotor()
        print("Motor Calibration Complete")

        finale = {"Strb Bounds":StrbBounds,
                  "Port Bounds":PortBounds,
                  "Rudder Bounds":RudderBounds,
                  "Motor Bounds":MotorBounds}

        print(finale)
        overall = json.dumps(finale)

        #write bounds to a file
        records = open("bounds.json", "w")
        records.write(overall)
        os.system('sudo mv bounds.json /etc/jaiabot/')
       
        please = True
        while please == True:
            upload = input("Would you like to upload control_surfaces? Yes/No ")
            upload = upload.upper()
            if upload == "YES":
                #uplaods control surfaces to the arduino
                os.system("cd ~/jaiabot/src/arduino/; ./upload_usb_old.sh control_surfaces")
                please = False
            elif upload == "NO":
                #leaves calibration running
                please = False
                calibrating = False
            else:
                print("Please enter Yes or No")

        misclick = False
        
                
    elif permission == "NO":
        iguessitwas = True
        while iguessitwas == True:
            upload = input("Would you like to upload control_surfaces? Yes/No ")
            upload = upload.upper()
            if upload == "YES":
                os.system("cd ~/jaiabot/src/arduino/; ./upload_usb_old.sh control_surfaces")
                iguessitwas = False
            elif upload == "NO":
                iguessitwas = False
            else:
                print("Please enter Yes or No")
        misclick = False
    else:
        print("Please enter Yes or No")

#cleaning up after myself
records.close()
arduino.close()
