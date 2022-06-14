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
    os.system('cd /etc/jaiabot/','sudo mv bounds.pb.cfg ~/jaiabot/scripts/calibration/')
    boundsCFG = open("bounds.pb.cfg","r")
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
    data = data.decode()
    return data

#writes to the serail moniter and sends the command - \n is the newline command
def write(command):
    command = str(command)
    command = command+'\n'
    arduino.write(bytes(command, 'utf_8'))

#if you input a value higher than 500 you are leaving the current region and entering the next limit, either center or one of the extremes
def wingInsurance(adjustment):
    x = True
    while x is True:
        if adjustment > 500 or adjustment < -500:
            print("this value is too high.")
            adjustment = int(input("How many microseconds to adjust by? values between -500 and 500 only. "))
        else:
            return adjustment

#talks to the arduino for wing inputs
def inputcommand():
    y = True
    while y is True:
        z = True
        f = True
        while f is True:
            try:
                adjustment = int(input("How many microseconds to adjust by? Values between -500 and 500 only. "))
                f = False
            except:
                print("please enter a number")
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
                write("Z")
                letitend = False
                
            else:
                print("Please enter Yes or No")
    return

#skipd wing calibration for user
def skipWing():
    write("0")
    write("Y")
    write("0")
    write("Y")
    write("0")
    write("Y")
    write("X")
    print("current bounds are ",rd())

#skips motor calibration for user
def skipMotor():
    write("Y")
    write("J")
    rd()
    print("current bound is 1600")
    write("Y")
    write("J")
    rd()
    print("current bound is 1400")
    write("Y")
    write("J")
    rd()
    print("current bound is 1500")
    write("Y")
    write("J")
    rd()
    print("current bound is 1500")
    write("C")
    
            
#talks to the arduino for motor bound calibration
def inputMotorCommand(comfirmation1, comfirmation2):
    y = True
    while y is True:
        z = True
        time.sleep(.6)
        currentSpeed = rd()
        print("the current speed is ", currentSpeed, "microseconds")
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
                    else:
                        print("Please enter yes or no")
            elif confirmation == "NO":
                write("N")
                z = False
            else:
                print("Please enter yes or no")

    #reformats the value output from the arduino serial moniter to be nice and pretty
    value = str(value)
    print(value)
    return value

def calibrateMotor():
    y = True

    while y is True:

        #calibrates the forward, backward, forward halt, and backward halt limitations
        print("calibrating forward start")
        check_bounds.motor.reverseStart = int(inputMotorCommand("is the motor moving? Yes/No ","Please wait 15 seconds. Is the motor still moving? Yes/No "))
        print("calibrating reverse start")
        check_bounds.motor.forwadStart = int(inputMotorCommand("is the motor moving? Yes/No ","Please wait 15 seconds. Is the motor still moving? Yes/No "))
        print("calibrating forward halt")
        check_bounds.motor.reverseHalt = int(inputMotorCommand("is the motor stopped? Yes/No ","Please wait 10 seconds. Is the motor still stopped? Yes/No "))
        print("calibrating reverse halt")
        check_bounds.motor.forwardHalt = int(inputMotorCommand("is the motor stopped? Yes/No ","Please wait 10 seconds. Is the motor still stopped? Yes/No "))

        end = True
        while end == True:
            finish = input("Would you like to stop calibrating the motor? Yes/No ")
            finish = finish.upper()
            if finish == "YES":
                write("C")

                #releases from the answer loop and ends calibration
                end = False
                y = False
                    
            elif finish == "NO":
                #releases from the answer loop and restarts calibration
                write("Z")
                end = False
            else:
                print("Please enter Yes or No")

    return

#actual running loop for calibration
begin = True
while begin == True:
    permission = input("would you like to calibrate the jaiabot? Yes/No ")
    permission = permission.upper()
    if permission == "YES":
        uplaod = True
        while uplaod == True:
            insert = input("do you need to upload the calibration script? Yes/No ")
            insert = insert.upper()
            if insert == "YES":
                print("system uploading...")
                os.system('cd ~/jaiabot/src/arduino/; /etc/jaiabot/arduino_upload.sh calibration/')
                uplaod = False
            elif insert == "NO":
                uplaod = False
            else:
                print("please enter Yes or No")

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
                if check_bounds.strb.upper == 0:
                    check_bounds.strb.upper = 1000
                if check_bounds.strb.lower == 0:
                    check_bounds.strb.lower = 2000
                if check_bounds.strb.center == 0:
                    check_bounds.strb.center = 1500
                skipWing()
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
                if check_bounds.port.upper == 0:
                    check_bounds.port.upper = 1000
                if check_bounds.port.lower == 0:
                    check_bounds.port.lower = 2000
                if check_bounds.port.center == 0:
                    check_bounds.port.center = 1500
                skipWing()
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
                if check_bounds.rudder.upper == 0:
                    check_bounds.rudder.upper = 1000
                if check_bounds.rudder.lower == 0:
                    check_bounds.rudder.lower = 2000
                if check_bounds.rudder.center == 0:
                    check_bounds.rudder.center = 1500
                skipWing()
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
                if check_bounds.motor.reverseStart == 0:
                    check_bounds.motor.reverseStart = 1600
                if check_bounds.motor.forwardStart == 0:
                    check_bounds.motor.forwardStart = 1400
                if check_bounds.motor.forwardHalt == 0:
                    check_bounds.motor.forwardHalt = 1500
                if check_bounds.motor.reverseHalt == 0:
                    check_bounds.motor.reverseHalt = 1500
                skipMotor()
                x = False
            else:
                print("please enter Yes or No")
        print("Motor Calibration Complete")

        print(str(check_bounds))

        #write bounds to a .pb.cfg file and moves it to /etc/jaiabot
        records = open("bounds.pb.cfg", "w")
        records.write(str(check_bounds))
        os.system('sudo mv bounds.pb.cfg /etc/jaiabot/')
        records.close()
        records = open("bounds.pb.cfg", "a")
        records.write("# on the JAIABOT, upper means STARBOARD on rudder and UP on the flaps")
        os.system('sudo mv bounds.pb.cfg /etc/jaiabot/')

        #ask the user to upload jaiabot_runtime and finish calibration
        please = True
        while please == True:
            upload = input("Would you like to upload jaiabot_runtime?? Yes/No ")
            upload = upload.upper()
            if upload == "YES":
                #uplaods control surfaces to the arduino
                os.system('cd ~/jaiabot/src/arduino/; /etc/jaiabot/arduino_upload.sh jaiabot_runtime/')
                please = False
            elif upload == "NO":
                #leaves jaiabot_calibration running
                please = False
                calibrating = False
            else:
                print("Please enter Yes or No")

        begin = False
        
    #if you skip calibration, will write some generic bounds that mostly work          
    elif permission == "NO":
        end = True
        while end == True:
            upload = input("Would you like to upload jaiabot_runtime? Yes/No ")
            upload = upload.upper()
            if upload == "YES":
                os.system('cd ~/jaiabot/src/arduino/; /etc/jaiabot/arduino_upload.sh jaiabot_runtime/')
                end = False
            elif upload == "NO":
                end = False
            else:
                print("Please enter Yes or No")

        if check_bounds.strb.upper == 0:
            check_bounds.strb.upper = 1000
        if check_bounds.strb.lower == 0:
            check_bounds.strb.lower = 2000
        if check_bounds.strb.center == 0:
            check_bounds.strb.center = 1500

        if check_bounds.rudder.upper == 0:
            check_bounds.rudder.upper = 1000
        if check_bounds.rudder.lower == 0:
            check_bounds.rudder.lower = 2000
        if check_bounds.rudder.center == 0:
            check_bounds.rudder.center = 1500

        if check_bounds.port.upper == 0:
            check_bounds.port.upper = 1000
        if check_bounds.port.lower == 0:
            check_bounds.port.lower = 2000
        if check_bounds.port.center == 0:
            check_bounds.port.center = 1500

        if check_bounds.motor.reverseStart == 0:
            check_bounds.motor.reverseStart = 1600
        if check_bounds.motor.forwardStart == 0:
            check_bounds.motor.forwardStart = 1400
        if check_bounds.motor.forwardHalt == 0:
            check_bounds.motor.forwardHalt = 1500
        if check_bounds.motor.reverseHalt == 0:
            check_bounds.motor.reverseHalt = 1500

        records = open("bounds.pb.cfg", "w")
        records.write(str(check_bounds))
        records.close()
        records = open("bounds.pb.cfg", "a")
        records.write("# on the JAIABOT, upper means STARBOARD on rudder and UP on the flaps")
        os.system('sudo mv bounds.pb.cfg /etc/jaiabot/')

        begin = False
    else:
        print("Please enter Yes or No")

#cleaning up and closing everything
records.close()
arduino.close()
