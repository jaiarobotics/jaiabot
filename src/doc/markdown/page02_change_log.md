# Version Notes

This following sections note the changes in each release version of jaiabot.

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