#!/usr/bin/env python3

#talks to the serial moniter
import serial

#this might be important, so it's staying
import time

#talks to the terminal
import os

#helps with protobuf processing
import google.protobuf.json_format

#the actual protobuf format
import bounds_pb2

#makes protobuf objects to have fun with
check_bounds = bounds_pb2.Bounds()
write_bounds = bounds_pb2.SurfaceBounds()

#tries to open the bounds config and inserts the values to the check_bounds object
try:
    os.system('cd /etc/jaiabot/','sudo mv output_bounds.pb.cfg ~/jaiabot/scripts/calibration/')
    boundsCFG = open("output_bounds.pb.cfg","r")
    boundsCFG = boundsCFG.read()
    google.protobuf.text_format.Parse(boundsCFG, check_bounds)
    boundsCFG.close()
except:
    pass

#opens the arduino for use
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
    return

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
                output = output.replace("n","")
                #output = output.replace("2"," ")
                output = output.split()

                write_bounds.upper = int(output[0])
                write_bounds.lower = int(output[1])
                write_bounds.center = int(output[2])
                return(write_bounds)

                #releases from the answer loop and ends calibration
                letitend = False
                y = False
                
            elif finish == "NO":

                #releases from the answer loop and restarts calibration
                letitend = False
                write("Z")
                
            else:
                print("Please enter Yes or No")
    return
                
    
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
            
#betcha cant guess what this does
def inputMotorCommand(comfirmation1, comfirmation2):
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
            print(comfirmation1)
            confirmation = input()
            confirmation = confirmation.upper()
            if confirmation == "YES":
                write("Y")
                x = True
                while x is True:
                    print(comfirmation2)
                    completion = input()
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
        check_bounds.motor.forwardStart = int(inputMotorCommand("is the motor moving? Yes/No ","ensure you are as close as possible to startup speed before confirming: is this the motor startup speed? Yes/No "))
        print("calibrating reverse start")
        check_bounds.motor.reverseStart = int(inputMotorCommand("is the motor moving? Yes/No ","ensure you are as close as possible to startup speed before confirming: is this the motor startup speed? Yes/No "))
        print("calibrating forward halt")
        check_bounds.motor.forwardHalt = int(inputMotorCommand("is the motor stopped? Yes/No ","ensure you are as close as possible to stopping speed before confirming: is this the motor stop speed? Yes/No "))
        print("calibrating reverse halt")
        check_bounds.motor.reverseHalt = int(inputMotorCommand("is the motor stopped? Yes/No ","ensure you are as close as possible to stopping speed before confirming: is this the motor stop speed? Yes/No "))

        #my scripts are like meseeks, not made for this world. existance is pain, and they would like to be free
        letitend = True
        while letitend == True:
            finish = input("Would you like to stop calibrating the motor? Yes/No ")
            finish = finish.upper()
            if finish == "YES":
                write("C")

                #releases from the answer loop and ends calibration
                letitend = False
                y = False
                    
            elif finish == "NO":
                #releases from the answer loop and restarts calibration
                letitend = False
                write("Z")
            else:
                print("Please enter Yes or No")

    return
#starts with the assumption that someone may have accidentally typed ./JAIABOT_calibration.py
misclick = True
while misclick == True:
    permission = input("would you like to calibrate the jaiabot? Yes/No ")
    permission = permission.upper()
    if permission == "YES":
        os.system('cd ~/jaiabot/src/arduino/; /etc/jaiabot/arduino_upload.sh calibration/')

        #ask the user to calibrate bounds
        x = True
        while x is True:
            calibrate = input("do you want to calibrate the starboard flap? Yes/No ")
            calibrate = calibrate.upper()
            if calibrate == "YES":
                check_bounds.strb.CopyFrom(calibrateWingSurface())
                print(str(check_bounds.strb))
                x = False
            elif calibrate == "NO":
                check_bounds.strb.upper = 1000
                check_bounds.strb.lower = 2000
                check_bounds.strb.center = 1500
                x = False
            else:
                print("please enter Yes or No")
        x = True
        calibrate = ""
        while x is True:
            calibrate = input("do you want to calibrate the port flap? Yes/No ")
            calibrate = calibrate.upper()
            if calibrate == "YES":
                check_bounds.port.CopyFrom(calibrateWingSurface())
                print(str(check_bounds.port))
                x = False
            elif calibrate == "NO":
                check_bounds.port.upper = 1000
                check_bounds.port.lower = 2000
                check_bounds.port.center = 1500
                x = False
            else:
                print("please enter Yes or No")
        x = True
        calibrate = ""
        while x is True:
            calibrate = input("do you want to calibrate the rudder? Yes/No ")
            calibrate = calibrate.upper()
            if calibrate == "YES":
                check_bounds.rudder.CopyFrom(calibrateWingSurface())
                print(str(check_bounds.rudder))
                x = False
            elif calibrate == "NO":
                check_bounds.rudder.upper = 1000
                check_bounds.rudder.lower = 2000
                check_bounds.rudder.center = 1500
                x = False
            else:
                print("please enter Yes or No")
        print("Surface Calibration Complete")
        x = True
        calibrate = ""
        while x is True:
            calibrate = input("do you want to calibrate the motor? Yes/No ")
            calibrate = calibrate.upper()
            if calibrate == "YES":
                calibrateMotor()
                print(str(check_bounds.motor))
                x = False
            elif calibrate == "NO":
                check_bounds.motor.forwardStart = 1600
                check_bounds.motor.reverseStart = 1380
                check_bounds.motor.forwardHalt = 1500
                check_bounds.motor.reverseHalt = 1500
                x = False
            else:
                print("please enter Yes or No")
        print("Motor Calibration Complete")

        print(str(check_bounds))

        #write bounds to a .pb.cfg file and moves it to /etc/jaiabot
        records = open("output_bounds.pb.cfg", "w")
        records.write(str(check_bounds))
        os.system('sudo mv output_bounds.pb.cfg /etc/jaiabot/')

        #desperately begs the user to upload control_surfaces and release it from its task
        please = True
        while please == True:
            upload = input("Would you like to upload control_surfaces? Yes/No ")
            upload = upload.upper()
            if upload == "YES":
                #uplaods control surfaces to the arduino
                os.system('cd ~/jaiabot/src/arduino/; /etc/jaiabot/arduino_upload.sh control_surfaces")
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
                os.system('cd ~/jaiabot/src/arduino/; /etc/jaiabot/arduino_upload.sh control_surfaces")
                iguessitwas = False
            elif upload == "NO":
                iguessitwas = False
            else:
                print("Please enter Yes or No")

        check_bounds.strb.upper = 1000
        check_bounds.strb.lower = 2000
        check_bounds.strb.center = 1500

        check_bounds.rudder.upper = 1000
        check_bounds.rudder.lower = 2000
        check_bounds.rudder.center = 1500

        check_bounds.port.upper = 1000
        check_bounds.port.lower = 2000
        check_bounds.port.center = 1500
                
        check_bounds.motor.forwardStart = 1600
        check_bounds.motor.reverseStart = 1400
        check_bounds.motor.forwardHalt = 1500
        check_bounds.motor.reverseHalt = 1500

        records = open("output_bounds.pb.cfg", "w")
        records.write(str(check_bounds))
        os.system('sudo mv output_bounds.pb.cfg /etc/jaiabot/')

        misclick = False
    else:
        print("Please enter Yes or No")

#cleaning up after myself
records.close()
arduino.close()
