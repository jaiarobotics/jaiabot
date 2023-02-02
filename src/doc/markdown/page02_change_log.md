# Version Notes

This following sections note the changes in each release version of jaiabot.

### 1.3.0

* Multi Message 
  * Old max for goals 14, new max 39

* Multiple JCC’s
  * Only one can be in control
  * Missions can be seen across JCC’s

* GPS requirements
  * This is split between transit and after a dive
  * Bot icon adds a satellite to indicate ReacquireGPS state

* Battery Percentage Warnings/Errors (30,20,10)

* Radio configuration gets created in /etc/jaiabot
  * It also gets recorded in meta data

* Dive task parameter for max depth accepts precision 1 (ex. 4.5) 

* New UI look
  * Accordian for bot details
  * Buttons in the bot details
  * Updated button layout for toolbars
  * New button indicators when clicked
  * Go to green/red rally buttons
  * JCC mission upload and download new buttons
    * There are new buttons once you click on the original save/upload buttons 
  * Hot Keys (Stop bot shift+bot#, bot details bot#)
  * Shutdown button is active for pre/post deployment and when the bot is stopped

* New plot tool capabilities
  * Delete button for graphs
  * Timeline
  * Table
  * CSV download

* Surf Task backend is added
  * Frontend to come!

### 1.2.0

* Added ability to change bot status rate in the Engineering Panel
  * Rate can be applied to single bot or to the entire fleet
* Updated MAC Cycle time from 1 second to 0.5 seconds

### 1.1.4

* GPS requirements were to tight. We increased the number of degraded checks to determine bad gps
* total_gps_degraded_fix_checks: 1 -> 2

### 1.1.3

* GPS requirements were to tight. We loosened the pdop and hdop requirements
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
