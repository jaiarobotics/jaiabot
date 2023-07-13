# Version Notes

This following sections note the changes in each release version of jaiabot.

### 1.5.3

* Goby Logger Config
  * Exclude moos group because the goby log got too big for Raspberry Pi to convert to h5 file

### 1.5.2

* JCC
  * Hub highlights when selected
  * Goals start at index 1
  * Hosted using apache2
  * Mission Creation Panel
    * Assign/unassign bots to runs
    * Flag on UI to indicate the run
  * Constant heading click-on-map button update
  * Remote control button
    * UI joystick to drive bot
    * Xbox controller support
  * Data download has a percentage complete
  * Most buttons have confirmations and alerts
  * Optimize Survey Panel
    * The ability to set the task of the last goal
  * Max goal limit is set to 15 per run
  * UI cleanup
  * Button states
  * Retry data offload in post deployment
  * Task packet icon updates

* Engineering Panel
  * Bottom Depth Safety
    * Default 0 meter
    * Ability to configure constant heading task if depth safety is triggered

* App Speed Increases
  * Adafruit BNO055 (IMU)
    * Loop speed increased from 1 Hz to 10 Hz
  * Atlas Scientific Ezo Ec (Salinity)
    * Loop speed increased from 1 Hz to 10 Hz
  * Jaiabot Engineering
    * Loop speed increased from 5 seconds to 1 Hz

* Bot Data Speed Increases
  * SPI gps increased from 1 Hz to 5 Hz
  * Node status increased from 1 Hz to 5 Hz

* Multi-Hub Support
  * Ability to have hubs that work with the bots interchangeably
  * They do not work as a team

* Systemd Sim Support
  * Ability to create virtual machines for the bots/hubs and run in a simulation

* Data Offload
  * Generation of KMZs that can be loaded in google earth
  * Accurate Percentage complete when downloading
  * Removal of logs decreased from 14 days old to 7 days old on the bots

* Xbee Driver Updates
  * Support for enabling AES (Advanced Encryption Standard)

* API Endpoints
  * Single waypoint endpoint (/jaia/single-waypoint-mission)

* Hub LED Button
  * The LED indicates different hub states
  * The button can control certain hub states

* Bug Fixes
  * When bot has no gps UI would crash occasionally
  * Using the tablet and optimize mission 
    * The user had to click too many times to get the line tool to work
  * Optimize mission bugs

### 1.4.0

* JCC
  * TypeScript
  * Hub icon
  * Mission toolbar moved from lower left to upper right

* Goal Timeout
  * Default is off
  * If goal timeout is reached bot executes task where it is
  * Optional: skip task is goal timeout is reached

* Bottom Depth Safety
  * Default 1 meter

* Engineering Panel
  * Dynamic GPS Requirements
    * Ability to Change GPS Requirements while operating
  * Engineering Status message is available with a query for one
  * Stealth Mode
    * Change bot status to No_RF
    * Task packets and bot status will no longer send
    * Default timeout is 10 minutes
    * Hub still has ability to command the bots
  * Query Bot 
    * Enter bot id and query for the bot status

* Pressure is adjusted before every dive
  * We utilize a pressure_adjusted variable to zero out pressure before a dive

* New State
  * IMU Restart State
    * When there is a IMU issue detected the bot will enter this state
    * The bot will stop driving for 10 seconds (configurable)
      * The bot will continue on the mission after the 10 second timeout

* App Speed Increases
  * PID Control
    * Loop speed increased from 2 Hz to 10 Hz
  * Arduino App Driver
    * Loop speed increased from 4 Hz to 10 Hz
  * Improves manual control

* Dive States Updates
  * Power Descent
    * Initial timer for power descent
      * Used to prevent detecting bottom to soon 
  * Powered Ascent
    * Switch between motor on and motor off
    * Default 5 seconds of motor on and 1 second motor off
    * If the motor restarts it needs a zero command initially

* IMU
  * Now use quaternions
  * We now detect bot roll 
    * Allows us to keep driving upside down
    * Weight of the bot will self correct while driving

* New Task
  * Constant Heading (Surf Task)
    * Drive on a heading for a certain amount of time
    * In this mode we disregard gps requirements

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
