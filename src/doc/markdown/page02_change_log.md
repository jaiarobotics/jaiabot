# Version Notes

This following sections note the changes in each release version of jaiabot.

### 1.1.3

* GPS requirements were to tight. We loosened the pdop and hdop requirements.
* PDOP <= 2.2 (GOOD)
* HDOP <= 1.3 (GOOD)

### 1.1.2

* Fixed IMU port switching
* Added warning in JED for throttle control

### 1.1.1

* Changing health enum ERROR__FAILED__JAIABOT_DATA_VISION -> ERROR__FAILED__JAIABOT_PLOT 
  * The release does not support this change yet

### 1.1.0

* New ramping logic that makes the motor ramping smoother
* New ability to send forward and reserve start motor speeds from the bounds file (/etc/jaiabot)
* Added boiler code for arduino version control

### 1.0.4

* Fixed missing requirements file for web and plot applications.

### 1.0.3

* Forgot to add Change log doc to release so users can follow changes easily

### 1.0.2

* Fixed pitch reporting by flipping imu value, this is due to IMU positioning in the bot

### 1.0.1

* Added speed protection so the user does not run the bot at an unsafe speed unknowningly
  * Comments in code were added to warn developer of potential consequences
  * if developer increases the value of safe speed in the code:
    * A confirm box appears when changing the mission speeds to warn the operator

### 1.0.0

* Initial release
