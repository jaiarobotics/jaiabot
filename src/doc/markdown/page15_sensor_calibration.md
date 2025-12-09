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
- The standard model of pH probe and sensor used on JaiaBots are the <a href=https://atlas-scientific.coms/embedded-solutions/ph-oem-circuit/>Atlas Scientific pH OEM Circuit</a> and <a href=https://atlas-scientific.com/probes/industrial-ph-probe/>Atlas Scientific Industrial pH Probe - with Temp.</a>
  - This calibration procedure is based for this combination of sensor and probe. Other combinations have not been tested
- This combination of probe and sensor is expected to hold its calibration for approximately 1 year
  - If it is known that the probe is operating in a strong acidic or basic environment, calibration should be performed more often (monthly in extreme cases)
  - The calibration should be verified before any important data is collected
- The recommended calibration procedure involved a 3-point calibration procedure 
  - Calibrating to a *Low*, *Mid*, and *High* value

##### **Materials**
- JaiaBot-BIO
- Hub
- Computer
- Low-, Mid-, and High-pH calibration solution
  - Recommended: <a href=https://atlas-scientific.com/calibration-solutions/ph-4-00-7-00-10-00-calibration-solutions/>Atlas Scientific pH 4.00, 7.00, 10.00 Calibration Solutions</a>
- Rinse bottle
-Calibration cap(s) 
-Bench top pH probe (optional)

##### **Important Tips**
- When the probe ie placed in solution, the sensing area on the tip should be completely submerged
- Ensure no bubbles are trapped on the tip of the probe when taking readings
- The probe and sensing area should be rinsed with fresh water whenever it is removed from solution
- When inputting the pH of the solution, be sure to consult the temperature compensation chart on the bottle
  - The value you use during calibration should be the value on the bottle compensated to the actual temperature of the solution
  - Failure to do so can result in an incorrect calibration and lead to false readings in the field
- The tip of the pH probe is extremely sensitive to impact and friction, so the utmost care should be used when going through this calibration
- Note that performing a *Mid Calibration* will also clear all previous calibration data - if re-calibration is needed after the initial calibration, keep this in mind

##### **Procedure**
*Overview:*
<br>

The *pH Probe Calibration* involves performing a *Mid*, then *Low*, then *High* calibration. This can be followed by a secondary *Low-* and/or *High-Calibration* to further improve the calibration if needed. 

**Start:**
1. Turn on your JaiaBot-BIO and Hub<br> 
  a. Wait for both to fully boot up
2. Navigate to the JaiaBot's Liaison page<br>
  a. *10.23.fleet_number.100 + bot_id:30000<br>
  b. e.g. for Fleet 35 Bot 5: *10.23.35.105:30000*
3. Click the *Scope* link<br>
  a. Look for the *jaiabot::pH* field and expand it
4. Open the *Commander* link in a new tab/window<br>
  a. Click the *Message* dropdown, then select *jaiabot.sensor.protobuf.SensorRequest*<br>
  b. Click the *calibration_type* dropdown, then select *START_PH_CALIBRATION*<br>
  c. Click the *time* field and input 1<br>
  d. Click *Send*, then in the pop-up window click *Send* again
5. Click the *calibration_type* dropdown, then select *CLEAR_PH_CALIBRATION*
6. Click *Send*, then in the pop-up window click *Send* again
7. Rinse the pH probe with tap water<br>
  a. *Do not dry the probe tip*

**Mid Calibration:**
1. Fill a calibration cap with the *Mid pH Calibration Solution*
2. Place the pH sensor into the cap
3. Watch the pH readings on the *Scope* page until they level out
4. Once the pH readings level out, send the calibration command<br>
  a. Click the *calibration_type* dropdown, then select *CALIBRATE_PH_MID*<br>
  b. Click the *calibration_value* field, then input the pH of the solution compensated to its current temperature<br>
  c. In the *Commander* page, click *Send*, then in the pop-up window click *Send* again
5. You should notice the pH readings change at this point

**Low Calibration:**
1. Fill a calibration cap with the *Low pH Calibration Solution*
2. Place the pH sensor into the cap
3. Watch the pH readings on the *Scope* page until they level out
4. Once the pH readings level out, send the calibration command<br>
  a. Click the *calibration_type* dropdown, then select *CALIBRATE_PH_LOW*<br>
  b. Click the *calibration_value* field, then input the pH of the solution compensated to its current temperature<br>
  c. In the *Commander* page, click *Send*, then in the pop-up window click *Send* again
5. You should notice the pH readings change at this point

**High Calibration:**
1. Fill a calibration cap with the *High pH Calibration Solution*
2. Place the pH sensor into the cap
3. Watch the pH readings on the *Scope* page until they level out
4. Once the pH readings level out, send the calibration command<br>
  a. Click the *calibration_type* dropdown, then select *CALIBRATE_PH_HIGH*<br>
  b. Click the *calibration_value* field, then input the pH of the solution compensated to its current temperature<br>
  c. In the *Commander* page, click *Send*, then in the pop-up window click *Send* again
5. You should notice the pH readings change at this point

**Finish:**
1. Test the calibration by putting the probe in each solution and watching the readings in real time<br>
  a. Readings should be within +/- 0.2 pH units of the temperature compensated expected pH of the solution<br>
  b. If the readings fall outside of this range, a *Low* and/or *High* calibration can be performed again to further improve the accuracy of the calibration
2. Once the calibration is tested successfully:<br>
  a. Click the *calibration_type* dropdown, then select *STOP_CALIBRATION*<br>
  b. In the *Commander* page, click *Send*, then in the pop-up window click *Send* again

  
## **Dissolved Oxygen**
##### **Background**
- The standard model of dissolved oxygen probe and sensor used on JaiaBots are the <a href=https://atlas-scientific.com/embedded-solutions/do-oem-circuit/>Atlas Scientific Dissolved Oxygen OEM Circuit</a> and <a href=https://atlas-scientific.com/probes/industrial-dissolved-oxygen-probe/>Atlas Scientific Industrial Dissolved Oxygen Probe</a>.
  - This calibration procedure is designed for this combination of sensor and probe. Other combinations have not been tested.
- This combination of probe and sensor is expected to hold its calibration for about 1 year
  - The calibration should be verified before data is collected.
- The electrolyte solution and membrane should be replaced if there is visible damage to the sensing tip, or after every 1-2 years of use.
- The recommended calibration procedure involves a 2-point calibration.
  - The sensor is calibrated to a *Low* and *High* value.

##### **Materials**
- JaiaBot-BIO
- Hub
- Computer
- Zero dissolved oxygen solution
  - Recommended: <a href=https://atlas-scientific.com/calibration-solutions/zero-dissolved-oxygen-calibration-solution-set/>Atlas Scientific Zero Dissolved Oxygen Calibration Set</a>
- Rinse bottle
- DO calibration cap (3/4 NPT thread cap)
  - This is included with your JaiaBot if it has a dissolved oxygen sensor
  - Extras can be purchased or built using PVC components from any hardware store

##### **Important Tips**
- When the probe is placed in solution, the entire probe tip should be completely submerged
- Ensure no bubbles are trapped on the sensing membrane at the tip of the probe when taking readings
- The probe tip and sensing membrane should be rinsed with fresh water whenever it is removed from solution

##### **Procedure**
*Overview:*
<br>
The calibration procedure for the Atlas Scientific Dissolved Oxygen Probe and Sensor involves calibrating the set to a *High* value (readings in-air), and then to a *Low* value (readings in zero dissolved oxygen solution). The readings in air may begin to climb over time - this is normal. The expected reading in air after a calibration is about 9.19 mg/L. Adding more *High* calibrations will being the readings back to normal and make in-water readings even more accurate. 

**Start:**
1. Turn on your JaiaBot-BIO and Hub<br>
  a.  Wait for both to fully boot up
2. Navigate to the JaiaBot's Liaison page<br>
  a. *10.23.fleet_number.100 + bot_id:30000*<br>
  b. e.g. for Fleet 35 Bot 5: *10.23.35.105:30000*
3. Click the *Scope* link<br>
  a. Look for the *jaiabot::dissolved_oxygen* field and expand it
4. Open the *Commander* link in a new tab/window<br>
  a. Click the *Message* dropdown, then select *jaiabot.sensor.protobug.SensorRequest*<br>
  b. Click the *calibration_type* dropdown, then select *START_DO_CALIBRATION*<br>
  c. In the *time* field, input 1<br>
  d. Click *Send*, then in the pop-up window click *Send* again
5. Click the *calibration_type* dropdown, then select *CLEAR_DO_CALIBRATION*
6. Click *Send*, then in the pop-up window click *Send* again
7. Rinse the dissolved oxygen probe with tap water

**High:**
1. Watch the dissolved oxygen readings on the *Scope* page until they level out
2. Once the readings have leveled out, send the calibration command<br>
  a. Click the *calibration_type* dropdown, then click *CALIBRATE_DO_HIGH*<br>
  b. In the commander page, click *Send*, the in the pop-up window click *Send* again

**Low:** 
1. Fill a calibration cap with *Zero Dissolved Oxygen* solution
2. Place the dissolved oxyegn sensor into the solution
3. Watch the dissolved oxygen readings on the *Scope* page until they level out
4. Once the dissolved oxygen readings level out at or near 0, send the calibration command<br>
  a. Click the *calibration_type* dropdown, then select *CALIBRATE_DO_LOW*<br>
  b. In the *Commander* page, click *Send*, then in the pop-up window click *Send* again

**Finish:**
1. Test the calibration by putting the probe in solution, watcing the readings in real time, then repeating in open air<br>
  - Readings should level out at 0 and ~9.19<br>
  - A *Low* and/or *High* calibration can be repeated to further improve the calibration
2. Once the calibration has been tested successfully:<br>
  a. Click the *calibration_type* dropdown, then select *STOP_CALIBRATION*<br>
  b. In the *Commander* page, click *Send* then in the pop-up window click *Send* again
3. Reinstall the calibration cap on the probe until the bot is ready for use

