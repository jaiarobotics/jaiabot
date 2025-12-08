# JaiaBot Sensor Calibration
*This document walks the reader through the calibration procedure for each of the JaiaBot's possible sensor configurations. As of December, 2025, these instructions are only supported on the JaiaBot-BIO variant.*
<br><br>

## **Contents**
- [Notes](#notes)
- [Conductivity](#conductivity)
  - [Background](#background)
  - [Materials](#materials)
- [pH](#ph)
  - [Background](#background-1)
  - [Materials](#materials-1)
- [Dissolved Oxygen](#dissolved-oxygen)
  - [Background](#background-2)
  - [Materials](#materials-2)
<br>

## **Notes**
## **Conductivity**
##### **Background**
- The standard model of conductivity probe and sensor used on the JaiaBot-BIO variants are the <a href=https://atlas-scientific.com/embedded-solutions/conductivity-oem-circuit/>*Atlas Scientific Conductivity OEM Circuit*</a> and <a href=https://atlas-scientific.com/probes/mini-e-c-probe-k-1-0/>*Atlas Scientific Mini-Conductivity Probe K1.0.*</a>
  - *This calibration procedure is designed for this combination of sensor and probe. Other combinations have not been tested or verified.*
- This combination of probe and sensor is expected to hold its calibration for *approximately 10 years.*
  - The manufacturer states that because of the nature of conductivity measurements and how these sensors operate, re-calibration *should not be necessary.*
  - *Calibration should still be verified before important conductivity data is collected.*
- The recommended calibration procedure involves a 3-point, rough/fine calibration procedure.
  - Calibrated to a Dry, Low, and High value.

##### **Materials**
- JaiaBot-BIO 
- Hub
- Computer
- Low- and High-Conductivity calibration solution
  - Recommended: <a href=https://atlas-scientific.com/calibration-solutions/industrial-conductivity-calibration-k-1-0-set/> Atlas Scientific Conductivity Calibration solution </a>
- Rinse bottle
- Small test tubes
- Bench top conductivity probe (optional)

##### **Important Tips**
- When the probe is submerged in solution, the sensing window should be completely submerged.
- Ensure no bubbles are trapped in the sensing window when taking readings. 
- Placing the probe in solution and then quickly removing it a few times can sometimes help readings settle faster than letting the probe sit in solution statically. 
- The probe and sensing window should be rinsed with fresh water whenever it is removed from solution.
- When inputting the conductivity of the solution, be sure the consult the temperature compensation chart on the bottle
  - The value you use during calibration should be the value on the bottle compensated to the actual temperature of the solution.
  - Failure to do so will result in an incorrect calibration and lead to false readings in the field. 
- Note that performing a *Dry Calibration* will also clear all previous calibration data - if re-calibration is needed after initial calibration, keep this in mind. 

##### **Procedure**
*Overview:*
<br>
The *Rough Calibration* involves performing a *Dry*, then *Low*, then *High*, calibration. This is then followed by a *Fine Calibration*, which only goes through a *Low*, then *High* calibration.

**Start:** 
<br>
1. Turn on your JaiaBot-BIO and Hub<br>
  a. Wait for both to fully boot up
2. Navigate to the JaiaBot's Liaison page
  a. *10.23.fleet_number.100 + bot_id:30000*<br>
  b. e.g. for Fleet 35 Bot 5: *10.23.35.105*
3. Click the *Scope* link<br>
  a. Look for the *jaiabot::Salinity* field and expand it
4. Open the *Commander* link in a new tab/window<br>
5. Send *Start Calibration* command<br>
  a. *Message* dropdown, select *jaiabot.sensor.protobuf.SensorRequest*<br>
  b. In the *calibation_type* dropdown, select *START_EC_CALIBRATION*<br>
  c. In the *Time* field, input *1*<br>
  d. Click *Send*, then in the pop-up window, click *Send* again<br>
5. Send the *Clear Calibration* command
  a. In the *calibration_type* dropdown, select *CLEAR_EC_CALIBRATION*<br>
  b.Click *Send*, then in the pop-up window, click *Send* again
6. Rinse the conductivity probe with tap water and dry with compressed air or a cloth

**Rough:**
<br>
*Dry:*
1. Send the *Calibrate Dry* command<br>
  a. In the *calibration_type* dropdown, select *CALIBRATE_EC_DRY*<br>
2. Watch the conductivity readings on the *Scope* page until they level out
  a. Found under the *Salinity* field
3. On the *Commander* page, click *Send*, then in the pop-up window, click *Send* again
  a. The conductivity readings should drop to 0

*Low:*
1. Fill a test tube with the *Low Calibration Solution* 
2. Place the conductivity probe into the solution
3. Watch the conductivity readings on the *Scope* page until they level out
4. Once the conductivity readings have setteled, send the *Low Calibration* command<br>
  a. In the *calibration_type* dropdown, select *CALIBRATE_EC_LOW*<br>
  b. In the *calibration_value* field, input the conductivity of the solution compensated to its temperature
  c. In the *Commander Page*, click *Send*, then in the pop-up window, click *Send* again
  d. The conductivity readings should *not* change at this point

*High:*
1. Fill a test tube with the *High Calibration Solution* 
2. Place the conductivity probe into the solution
3. Watch the conductivity readings on the *Scope* page until they level out
4. Once the conductivity readings have setteled, send the *High Calibration* command<br>
  a. In the *calibration_type* dropdown, select *CALIBRATE_EC_HIGH*<br>
  b. In the *calibration_value* field, input the conductivity of the solution compensated to its temperature
  c. In the *Commander Page*, click *Send*, then in the pop-up window, click *Send* again
  d. The conductivity readings *should* change at this point

**Fine:**<br>
*Repeat the Low and High calibration processes*

*Low:*
1. Fill a test tube with the *Low Calibration Solution* 
2. Place the conductivity probe into the solution
3. Watch the conductivity readings on the *Scope* page until they level out
4. Once the conductivity readings have setteled, send the *Low Calibration* command<br>
  a. In the *calibration_type* dropdown, select *CALIBRATE_EC_LOW*<br>
  b. In the *calibration_value* field, input the conductivity of the solution compensated to its temperature
  c. In the *Commander Page*, click *Send*, then in the pop-up window, click *Send* again

*High:*
1. Fill a test tube with the *High Calibration Solution* 
2. Place the conductivity probe into the solution
3. Watch the conductivity readings on the *Scope* page until they level out
4. Once the conductivity readings have setteled, send the *High Calibration* command<br>
  a. In the *calibration_type* dropdown, select *CALIBRATE_EC_HIGH*<br>
  b. In the *calibration_value* field, input the conductivity of the solution compensated to its temperature
  c. In the *Commander Page*, click *Send*, then in the pop-up window, click *Send* again

**Finish:**
1. Test the calibration by putting the probe in each solution and watching the readings in real-time<br>
  a. Readings should be within 2% of the temperature compensated expected conductivity of the solution<br>
  b. If readings are outside of 2%, a *Low* and/or *High* calibration can be repeated to further improve the calibration
2. Once the calibration is tested successfully:<br>
  a. In the *calibration_type* dropdown, select *STOP_CALIBRATION*<br>
  b. Click *Send*, then in the pop-up window click *Send* again 

## **pH**
##### **Background**
##### **Materials**
## **Dissolved Oxygen**
##### **Background**
##### **Materials**

