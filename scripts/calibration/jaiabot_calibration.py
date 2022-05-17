#!/usr/bin/env python3

#talks to the serial moniter
import serial

import time

#talks to the terminal
import os

#hels with protobuf processing
import google.protobuf.json_format

#the actual protobuf format
import bounds_pb2

#arduino = serial.Serial('/dev/cu.usbserial-143230', 19200,timeout = .1)
arduino = serial.Serial('/etc/jaiabot/dev/arduino', 19200,timeout = .1)

#reads from the arduino serial moniter
def rd():
    data = arduino.readline()
    return data

#writes to the serail moniter and send the command - \n is the newline command
def write(command):
    command = str(command)
    command = command+'\n'
    arduino.write(bytes(command, 'utf_8'))

#if you input a value higher than 500 you are leaving the current region and entering the next limit, either center or one fo the extremes
def wingInsurance(adjustment):
    x = True
    while x is True:
        if adjustment > 500 or adjustment < -500:
            print("this value is too high.")
            adjustment = int(input("How many microseconds to adjust by? values between -500 and 500 only. "))
        else:
            return adjustment
#betcha cant guess what thid doesss
def inputcommand():
    y = True
    while y is True:
        z = True
        adjustment = int(input("How many microseconds to adjust by? Values between -500 and 500 only. "))
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
                write("N")
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

                #formatting the string to be a nice readable string
                output = rd()
                output = str(output)
                output = output.replace("b","")
                output = output.replace("'","")
                output = output.replace("/","")
                output = output.replace("r","")
                output = output.replace("\\","")
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

                return limits

                #releases from the answer loop and ends calibration
                letitend = False
                y = False
                
            elif finish == "NO":

                #releases from the answer loop and restarts calibration
                letitend = False
                write("Z")
                
            else:
                print("Please enter Yes or No")
                
    
#makes sure the motor isnt sent such a low value it inevitably crashes. the minimum speed may be tweaked if the tails proved a significant amount of resistance,
#25 was determined without a tail mount
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
    #reformats the value output from the arduino serial moniter to be nice and pretty          
    value = str(value)
    value = value.replace("b","")
    value = value.replace("'","")
    print(value)
    return value

#is basically the same thing as above, but with slightly different prompts.
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

    #reformats the value output from the arduino serial moniter to be nice and pretty
    value = str(value)
    value = value.replace("b","")
    value = value.replace("'","")
    print(value)
    return value

def calibrateMotor():
    y = True

    while y is True:

        #calibrates the forward, backward, forward halt, and backward halt limitations
        print(rd())
        print("calibrating forward start")
        startup = inputMotorCommand()
        print("calibrating reverse start")
        startdown = inputMotorCommand()
        print("calibrating forward halt")
        haltup = inputHaltCommand()
        print("calibrating reverse halt")
        haltdown = inputHaltCommand()

        #my scripts are like meseeks, not made for this world. existance is pain, and they would like to be free
        letitend = True
        while letitend == True:
            finish = input("Would you like to stop calibrating the motor? Yes/No ")
            finish = finish.upper()
            if finish == "YES":
                write("C")
                motorParameters = {"forwardStart":startup,
                                   "reverseStart":startdown,
                                   "forwardHalt":haltup,
                                   "reverseHalt":haltdown}
                return motorParameters

                #releases from the answer loop and ends calibration
                letitend = False
                y = False
                    
            elif finish == "NO":
                #releases from the answer loop and restarts calibration
                letitend = False
                write("Z")
            else:
                print("Please enter Yes or No")

#starts with the assumption that someone may have accidentally typed ./JAIABOT_calibration.py
misclick = True
while misclick == True:
    permission = input("would you like to calibrate the jaiabot? Yes/No ")
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

        #compiles the overall ouputs into a dictionary to be converted to a proto format
        finale = {"strb":StrbBounds,
                  "port":PortBounds,
                  "rudder":RudderBounds,
                  "motor":MotorBounds}

        #displays the results of the user's hard work and writes it intoa proto format
        print(finale)
        overall = google.protobuf.json_format.ParseDict(finale, bounds_pb2.Bounds())

        #write bounds to a .pb.cfg file and moves it to /etc/jaiabot
        records = open("output_bounds.pb.cfg", "w")
        records.write(str(overall))
        os.system('sudo mv output_bounds.pb.cfg /etc/jaiabot/')

        #desperately begs the user to upload control_surfaces and release it from its task
        please = True
        while please == True:
            upload = input("Would you like to upload control_surfaces? Yes/No ")
            upload = upload.upper()
            if upload == "YES":
                #uplaods control surfaces to the arduino
                os.system("cd ~/jaiabot/src/arduino/; ./upload_usb_old.sh control_surfaces")
                please = False
            elif upload == "NO":
                #leaves JAIABOT_calibration running
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
