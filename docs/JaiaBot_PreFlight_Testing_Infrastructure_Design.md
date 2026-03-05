# JaiaBot Pre-Flight Testing Infrastructure
## Design Document

**Version:** 1.0  
**Date:** February 26, 2026  
**Status:** Design Specification

---

## Executive Summary

The JaiaBot Pre-Flight Testing Infrastructure is a web-based automated testing system designed to streamline and standardize the pre-flight testing process for JaiaBot autonomous underwater vehicles. The system guides operators through a comprehensive 10-step checklist, automatically collects sensor data where possible, and generates a standardized test report for each bot.

### Key Goals
- **Minimize operator workload** through automation and guided workflows
- **Ensure consistency** across all bot testing procedures
- **Automatic data collection** from bot systems (GPS, IMU, sensors)
- **Generate documentation** automatically in standardized format
- **Reduce human error** through validation and confirmations

---

## System Overview

### What It Does
The testing infrastructure is a standalone web application that runs on the JaiaBot hub computer. Operators access it through a web browser and are guided step-by-step through the pre-flight testing process. The system automatically fetches data from the bot's systems where possible and requires operator confirmation for physical checks.

### How Operators Use It
1. Operator opens web browser to `http://hub-ip:40012`
2. System runs on hub and extracts Fleet ID
3. System displays list of all bots in fleet (auto-detected)
4. Operator performs fleet-level checks (hub battery, tablet, network)
5. System begins per-bot testing sequence
6. For each bot in the fleet:
   - System clearly displays: **"Testing Bot [ID] (Bot X of Y)"**
   - Operator proceeds through 10 guided test steps for this bot
   - System automatically collects sensor data for this bot
   - Operator confirms physical checks for this bot
   - System saves results and moves to next bot
7. Upon completion of all bots, system generates comprehensive fleet test report: `Fleet[ID]_PreFlight_[Date].pdf`

### Where It Runs
- **Server:** JaiaBot hub for a specific fleet (if multiple hubs, uses the first one: 10.23.fleet.11), port 40012
- **Access:** Any device with web browser on the network
- **Data Source:** JCC (Jaia Command & Control), JED (Jaia Engineer & Debug), Liaison
- **Output:** Test reports saved to `/var/log/jaiabot/test-reports/`

---

## Fleet-Level Pre-Checks (Performed Once)

Before testing individual bots, the operator performs these fleet-wide checks once:

### Fleet Check 1: Hub Battery
**Purpose:** Ensure hub has sufficient power for entire testing session  
**Operator Action:** Visual inspection of hub battery indicator lights  
**Automation:** None (physical check)  
**Validation:** Operator confirms 2+ solid lights are lit  
**Time:** ~10 seconds

**What Operator Sees:**
- **Header: "Fleet [ID] Pre-Flight Setup"**
- Clear instruction: "Check hub battery indicator"
- Visual guide showing where battery lights are located
- Checkbox: "Hub has 2 or more solid lights"
- If unchecked: Warning message to bring external battery

### Fleet Check 2: Tablet Setup
**Purpose:** Verify operator's tablet is ready for field operations  
**Operator Action:** Check map tiles loaded, battery level  
**Automation:** System queries tablet battery level via API (optional)  
**Validation:** Battery must be >75%  
**Time:** ~15 seconds

**What Operator Sees:**
- Auto-populated battery percentage (fetched from system or input by operator)
- Status indicator: Green if >75%, Red if <75%
- Checkbox: "Map tiles verified in JCC"
- If battery low: Alert to connect charger

### Fleet Check 3: Network Connectivity
**Purpose:** Verify all bots in fleet are communicating with hub  
**Operator Action:** Review bot connection status  
**Automation:** System automatically detects all connected bots; periodically checks connectivity during startup  
**Validation:** All bots must show "Connected" status  
**Time:** ~20 seconds

**What Operator Sees:**
- Table showing all bots in fleet
- Connection status for each bot (Green = Connected, Red = Disconnected)
- Last communication timestamp for each bot
- Warning if any bot is not responding
- Option to proceed with only connected bots or troubleshoot disconnected bots

**After Fleet-Level Checks Complete:**
- System displays: "Fleet Setup Complete - Ready to Test [X] Bots"
- Button: "Begin Bot Testing"

---

## Per-Bot Testing Sequence (Repeated for Each Bot)

**Important:** All 10 steps below are performed for EACH bot in the fleet. The system clearly shows which bot is being tested at all times.

### Bot Testing Header (Always Visible)
Throughout bot testing, operator sees:
```
┌─────────────────────────────────────────────────────┐
│  Testing: Bot [ID]  (Bot X of Y)                   │
│  Fleet: [Fleet ID]                                  │
│  Progress: Step [N] of 10                          │
└─────────────────────────────────────────────────────┘
```

---

### Step 1: Bot Power Status
**Purpose:** Verify this specific bot's battery is sufficiently charged  
**Operator Action:** None (automatic)  
**Automation:** System queries battery percentage from this bot  
**Validation:** Must be ≥75%  
**Time:** ~5 seconds  

**What Operator Sees:**
- **Header: "Bot [ID] - Step 1 of 10: Battery Check"**
- Auto-fetched battery percentage with large display
- Green indicator if ≥75%, Red if <75%
- Battery voltage history graph for this bot
- If low: Prompt asking operator to replace battery
- Button: "Next Bot Step" (proceeds to Step 2)

---

### Step 2: Bot Communication Check
**Purpose:** Verify this bot is responding to commands  
**Operator Action:** None (automatic)  
**Automation:** System sends test ping and checks round-trip communication time  
**Validation:** Response time <500ms  
**Time:** ~10 seconds  

**What Operator Sees:**
- **Header: "Bot [ID] - Step 2 of 10: Communication Test"**
- Real-time ping display
- Response time measurement
- Green "Connected" indicator if successful
- If communication fails: Alert and troubleshooting steps

---

### Step 3: Motor & Rudder Bounds Verification
**Purpose:** Verify motor and rudder calibration values are correct, with option to fix if needed  
**Operator Action:** Review fetched values, fix any incorrect values if needed  
**Automation:** System automatically fetches values from JED via API and validates against expected calibration  
**Validation:** Values must match expected calibration  
**Time:** ~30 seconds (longer if fixes needed)

**Expected Calibration Values:**
| Parameter | Expected Value |
|-----------|---------------|
| Forward Start | 1650 |
| Reverse Start | 1410 |
| Max Reverse | 1320 |
| Throttle for Zero Net Buoyancy | -35 |
| Throttle Dive | -45 |
| Throttle Ascent | 25 |

**What Operator Sees:**
- **Header: "Bot [ID] - Step 3 of 10: Motor & Rudder Bounds"**
- Button: "Fetch & Verify Motor Bounds for Bot [ID]"
- System displays retrieved values in table format
- Green checkmarks next to correct values (Pass)
- Red X next to incorrect values (Fail)

**If All Values Correct:**
- Display "All values verified ✓"
- Button: "Next Bot Step"

**If Any Values Incorrect:**
- Alert message: "X value(s) need correction"
- Editable fields appear for each incorrect value
- Button: "Fix Values" - allows operator to correct values directly in JED
- After fixing: Button "Re-Verify" - system re-fetches and validates
- Process repeats until all values pass
- Skip Option: "Skip Bot (Mark as Failed)" - bot marked as failed in report

**Test Result Saved:**
- **Pass:** All values match expected calibration
- **Fail:** Operator chose not to or could not fix incorrect values

---

### Step 4: Sensor Readings Capture
**Purpose:** Record baseline sensor readings before deployment  
**Operator Action:** Click "Collect Sensor Data" button  
**Automation:** System automatically queries and saves sensor data  
**Validation:** Data must be present and reasonable  
**Time:** ~20 seconds  

**Data Collected (Sampled, Not Timeseries):**
- GPS coordinates (latitude, longitude, altitude)
- GPS fix quality and satellite count
- IMU orientation (roll, pitch, yaw)
- IMU calibration status
- Temperature sensors
- Pressure sensors
- Battery voltage

**What Operator Sees:**
- **Header: "Bot [ID] - Step 4 of 10: Sensor Data Collection"**
- Button: "Collect All Sensor Data for Bot [ID]"
- Progress indicator while data is being fetched
- Table showing all collected values
- Timestamp of data collection
- All data automatically saved to fleet test report

**Technical Note:** Data is fetched via REST API calls to JCC sensor endpoints

---

### Step 5: Motor Status Verification
**Purpose:** Confirm motor controller is communicating and collect baseline motor data  
**Operator Action:** Review displayed data  
**Automation:** System sets motor to RC Speed 1, waits 5 seconds, collects RPM and temperature  
**Validation:** Data must be present and updating  
**Time:** ~15 seconds  

**What Operator Sees:**
- **Header: "Bot [ID] - Step 5 of 10: Motor Status"**
- System automatically runs motor at RC Speed 1 for 5 seconds
- Displays collected motor temperature and RPM for this bot
- Green "Connected" indicator if data is flowing
- Instructions to check Liaison if data not present

**Data Saved (Sampled):**
- Motor temperature
- Motor RPM

---

### Step 6: Rudder Position Baseline
**Purpose:** Record baseline rudder position before movement tests  
**Operator Action:** None (automatic)  
**Automation:** System fetches current rudder position  
**Validation:** Rudder angle must be reasonable (-45° to +45°)  
**Time:** ~5 seconds  

**What Operator Sees:**
- **Header: "Bot [ID] - Step 6 of 10: Rudder Position Baseline"**
- Current rudder angle displayed
- Visual rudder position indicator
- Data automatically saved to report

---

### Step 7: Motor Temperature Baseline
**Purpose:** Record baseline motor temperature before operation  
**Operator Action:** None (automatic)  
**Automation:** System fetches current motor temperature  
**Validation:** Temperature must be reasonable (5-40°C)  
**Time:** ~5 seconds  

**What Operator Sees:**
- **Header: "Bot [ID] - Step 7 of 10: Motor Temperature"**
- Current motor temperature displayed
- Temperature automatically saved to fleet report

---

### Step 8: RC Speed Tests
**Purpose:** Verify motor responds to speed commands  
**Operator Action:** Confirm ready to start each test, review results, mark pass/fail  
**Automation:** System automatically sends RC commands and samples motor RPM for each test  
**Validation:** RPM must change appropriately with each speed setting  
**Time:** ~45 seconds  

**What Operator Sees:**
- **Header: "Bot [ID] - Step 8 of 10: RC Speed Tests"**
- **Prominent reminder: "TESTING BOT [ID]"**

**For each speed test, the system:**
1. Displays test description and asks operator to confirm "Ready to Start"
2. Operator clicks "Ready" button
3. System automatically sends RC command
4. System samples RPM value (single point, not timeseries)
5. System displays sampled RPM result
6. Operator reviews and selects "Pass" or "Fail"
7. System proceeds to next test

**Automated Test Sequence:**
| Test | Command | Data Saved |
|------|---------|------------|
| Test 1 | RC Speed 1 | Sampled RPM + Pass/Fail |
| Test 2 | RC Speed 2 | Sampled RPM + Pass/Fail |
| Test 3 | RC Reverse Speed 1 | Sampled RPM + Pass/Fail |

---

### Step 9: Rudder Movement Tests
**Purpose:** Verify rudder control system functioning  
**Operator Action:** Confirm ready to start each test, review results, mark pass/fail  
**Automation:** System automatically sends rudder commands and samples rudder angle for each test  
**Validation:** Rudder angle must change appropriately  
**Time:** ~45 seconds  

**What Operator Sees:**
- **Header: "Bot [ID] - Step 9 of 10: Rudder Tests"**
- **Prominent reminder: "TESTING BOT [ID]"**

**For each rudder test, the system:**
1. Displays test description and asks operator to confirm "Ready to Start"
2. Operator clicks "Ready" button
3. System automatically sends rudder command
4. System samples rudder angle value (single point, not timeseries)
5. System displays sampled rudder angle result
6. Operator reviews and selects "Pass" or "Fail"
7. System proceeds to next test

**Automated Test Sequence:**
| Test | Command | Data Saved |
|------|---------|------------|
| Test 1 | Rudder Starboard 3 | Sampled angle + Pass/Fail |
| Test 2 | Rudder Port 3 | Sampled angle + Pass/Fail |
| Test 3 | Rudder 0 (centered) | Sampled angle + Pass/Fail |

---

### Step 10: Propeller Security Check
**Purpose:** Ensure propeller is securely attached  
**Operator Action:** Listen for unusual sounds while motor runs, confirm security  
**Automation:** System runs motor at low speed for operator to listen  
**Validation:** Operator confirms no unusual sounds/vibrations  
**Time:** ~15 seconds  

**What Operator Sees:**
- **Header: "Bot [ID] - Step 10 of 10: Propeller Security"**
- **Prominent reminder: "TESTING BOT [ID]"**
- System runs motor at low speed
- Clear instructions: "Listen for unusual sounds or vibrations from Bot [ID]"
- Checkbox: "Propeller on Bot [ID] sounds secure"
- Warning: Do not proceed if sounds abnormal for this bot

---

### After Completing Step 10 for Current Bot:
- System displays: "Bot [ID] Testing Complete!"
- Shows summary of pass/fail for this bot
- Option to add comments about this bot
- If more bots remain:
  - Button: "Begin Testing Bot [NextID]" (moves to Step 1 for next bot)
- If this was the last bot:
  - Button: "Generate Fleet Test Report"

---

## Automation and Data Collection

### Data Storage Approach

**Sampled Data (Not Timeseries):**
All sensor data collected during testing is stored as single-point samples with timestamps, not as continuous timeseries data. This approach:
- Reduces storage requirements
- Simplifies data analysis and reporting
- Provides clear snapshots of bot state at test time
- Enables easy comparison across bots and test sessions

**Data Saved Per Test:**
- Timestamp of sample
- Single value (or small set of values) for each data point
- Pass/fail status where applicable
- Operator confirmation where required

### Automatic Data Collection Points

| # | Data Type | Source | Frequency | Storage |
|---|-----------|--------|-----------|---------|
| 1 | Tablet Battery Level | Tablet system API or operator input | Real-time | Single value |
| 2 | Motor & Rudder Bounds | JED API endpoint | On-demand (button click) | Six numerical values |
| 3 | GPS Data | JCC sensor API | On-demand during Step 4 | Single sample |
| 4 | IMU Data | JCC sensor API | On-demand during Step 4 | Single sample |
| 5 | Environmental Sensors | JCC sensor API | On-demand during Step 4 | Single sample |
| 6 | Battery Voltage and Current | JCC power API | On-demand during Step 1 | Single sample |
| 7 | Motor Telemetry | Liaison interface | On-demand during Steps 5, 7, 8 | Single samples |
| 8 | Rudder Position | JCC actuator API | On-demand during Steps 6, 9 | Single samples |

### Manual Confirmation Points

These require operator review and confirmation:

| Step | Check Type | Operator Action |
|------|------------|-----------------|
| Fleet Check 1 | Hub battery lights | Visual check |
| Fleet Check 2 | Map tiles loaded | Visual check in JCC |
| Step 3 | Motor & Rudder Bounds | Review values, fix if needed |
| Step 8 | RC Speed Tests | Confirm "Ready" and mark Pass/Fail for each test |
| Step 9 | Rudder Tests | Confirm "Ready" and mark Pass/Fail for each test |
| Step 10 | Propeller security | Auditory/visual check |

---

## Test Report Generation

### Report Filename Format
```
Fleet[FleetID]_PreFlight_[YYYY-MM-DD_HHMMSS].pdf
```

**Examples:**
- `Fleet3_PreFlight_2026-02-26_143022.pdf`
- `Fleet1_PreFlight_2026-02-26_080015.pdf`

### Report Contents

#### Section 1: Fleet Summary

**Fleet Header:**
- Fleet ID
- Test Date and Time
- Operator Name (input at start)
- Hub ID
- Total Test Duration
- Number of Bots Tested
- Overall Fleet Pass/Fail Status

**Fleet-Level Checks:**
- Hub battery status
- Tablet battery status
- Network connectivity status
- Timestamp of fleet setup completion

**Fleet-Wide Status Table:**
```
┌────────┬───────────────┬──────────────┬─────────────┐
│ Bot ID │ Overall Status│ Issues Found │ Test Time   │
├────────┼───────────────┼──────────────┼─────────────┤
│ Bot 1  │ ✓ PASS        │ None         │ 3.5 min     │
│ Bot 2  │ ✓ PASS        │ None         │ 3.5 min     │
│ Bot 3  │ ⚠ WARNING     │ Low Battery  │ 3.5 min     │
│ Bot 4  │ ✗ FAIL        │ Motor Issue  │ 2.0 min     │
└────────┴───────────────┴──────────────┴─────────────┘
```

**Fleet Readiness Assessment:**
- Number of bots ready for deployment
- Number of bots requiring attention
- Number of bots failed
- Deployment recommendation

#### Section 2: Individual Bot Reports (One Per Bot)

**Bot Header:**
- Bot ID prominently displayed
- Individual test duration
- Overall pass/fail for this bot
- Test timestamp

**Per-Bot Test Results Summary:**
- Table showing pass/fail for each of 10 steps
- Color-coded: Green (Pass), Red (Fail), Yellow (Warning)

**Detailed Step Results:**
For each of the 10 steps:
- Step number and title
- Timestamp
- Pass/Fail status
- All collected data points
- Operator comments (if any)

**Sensor Data Section:**
- GPS coordinates
- IMU orientation
- Complete sensor readings table
- Battery status at time of test

**Motor Performance Data:**
- Motor temperature readings
- RPM achieved during speed tests
- Rudder angle measurements

#### Section 3: Fleet Analysis and Comparisons (Optional)

**Comparative Data Across Fleet:**
- Battery performance comparison chart
- Motor temperature comparison
- GPS fix quality comparison
- IMU calibration status comparison

**Identified Issues:**
- List of all warnings and failures across fleet
- Recommended actions for each issue

**Fleet Health Metrics:**
- Average battery health
- Average motor performance
- Sensor reliability metrics
- Communication quality metrics

### Report Storage
- **Location:** `/var/log/jaiabot/test-reports/`
- **Retention:** Reports kept for 1 year
- **Access:** Available for download through web interface

---

## Operator Workflow

### Phase A: Fleet Setup (One Time)

1. **Access System**
   - Open web browser
   - Navigate to `http://[hub-ip]:40012/`
   - System loads testing interface
   - **Time:** ~5 seconds

2. **Select Fleet**
   - Fleet ID (dropdown from available fleets)
   - Operator name (auto-populated from login)
   - System automatically detects all bots in selected fleet
   - **Time:** ~10 seconds

3. **Fleet-Level Pre-Checks**
   - Fleet Check 1: Hub battery verification (~10 seconds)
   - Fleet Check 2: Tablet setup verification (~15 seconds)
   - Fleet Check 3: Network connectivity check (~20 seconds)
   - System displays: "Ready to test [X] bots"
   - **Total Phase A Time:** ~1 minute

### Phase B: Per-Bot Testing (Repeated for Each Bot)

4. **System Initiates Bot Testing**
   - System displays: **"Testing Bot [ID] (Bot X of Y)"**
   - Large, clear bot identifier always visible

5. **Progress Through 10 Steps for Current Bot**
   
   | Step | Name | Time | Type |
   |------|------|------|------|
   | 1 | Bot Battery Check | ~5 sec | Automatic |
   | 2 | Bot Communication Test | ~10 sec | Automatic |
   | 3 | Motor & Rudder Bounds | ~30 sec | Automatic fetch, operator reviews/fixes |
   | 4 | Sensor Data Collection | ~20 sec | Automatic, saves sampled data |
   | 5 | Motor Status | ~15 sec | Automatic |
   | 6 | Rudder Position Baseline | ~5 sec | Automatic |
   | 7 | Motor Temperature | ~5 sec | Automatic |
   | 8 | RC Speed Tests | ~45 sec | Automated tests, operator confirms ready and marks pass/fail |
   | 9 | Rudder Tests | ~45 sec | Automated tests, operator confirms ready and marks pass/fail |
   | 10 | Propeller Security | ~15 sec | Operator auditory check |
   
   **Per-Bot Testing Time:** ~3.5 minutes

6. **Bot Test Completion**
   - System shows summary for current bot
   - Pass/fail status clearly indicated
   - Option to add comments about this bot
   - System automatically saves bot results

7. **Move to Next Bot**
   - If more bots remain: System displays "Begin Testing Bot [NextID]"
   - Repeat Phase B steps for each bot

### Phase C: Fleet Report Generation (One Time)

8. **All Bots Complete**
   - System displays: "All Bots Tested - Fleet [ID] Complete!"
   - Shows fleet-wide summary table

9. **Generate Comprehensive Report**
   - Operator clicks "Generate Fleet Test Report"
   - System creates single PDF
   - Report saved as: `Fleet[ID]_PreFlight_[YYYY-MM-DD_HHMMSS].pdf`
   - **Time:** ~30 seconds

### Total Time Estimates

#### For a Typical 4-Bot Fleet:
| Phase | Time |
|-------|------|
| Fleet Setup (Phase A) | ~1 minute (one time) |
| Per-Bot Testing (Phase B) | ~3.5 minutes × 4 bots = ~14 minutes |
| Report Generation (Phase C) | ~0.5 minutes (one time) |
| **Total** | **~15.5 minutes** |

#### Comparison to Previous Manual Process:
| Metric | Old Manual | New Automated |
|--------|------------|---------------|
| Time per bot | ~15 minutes | ~3.5 minutes |
| Total for 4 bots | 60 minutes | 15.5 minutes |
| Time savings | - | **74% reduction** |

#### Breakdown by Automation:
- **Fully Automated:** ~40% of testing (data collection, validation)
- **Operator Confirmation:** ~30% of testing (reviewing auto-collected data)
- **Physical Testing:** ~30% of testing (RC tests, propeller check)

---

## System Architecture

### Components

| Component | Description |
|-----------|-------------|
| Web Server (Flask) | Runs on JaiaBot hub, port 40012, serves testing application |
| Web Application (React) | Single-page application with step-by-step wizard interface |
| Data Collection Layer | API clients for JCC, JED, Liaison; data validation and sanitization |
| Report Generator | PDF generation engine with template-based reports |

### Data Flow

```
Operator Browser
       ↓
Web Application (React)
       ↓
Flask Server (Port 40012)
       ↓
API Endpoints
  ├→ JCC (sensors, GPS, IMU)
  ├→ JED (motor bounds)
  └→ Liaison (motor telemetry)
       ↓
Data Aggregation
       ↓
Report Generator
       ↓
PDF Report File
```

---

## Glossary

| Term | Definition |
|------|------------|
| Bot | JaiaBot autonomous underwater vehicle unit |
| Fleet | Group of bots deployed together in same operational area |
| Hub | Central communication and control unit for JaiaBot fleet |
| JCC | Jaia Command & Control - primary operator interface |
| JED | Jaia Engineer & Debug - engineering diagnostic tool |
| Liaison | Real-time telemetry display system |
| IMU | Inertial Measurement Unit - orientation and motion sensor |
| RC | Radio Control - manual control mode for testing |
| Pre-Flight Check | Comprehensive testing before bot deployment |
| ESC | Electronic Speed Controller - motor driver |
| RPM | Revolutions Per Minute - motor speed measurement |

---

## Support and Training

### Operator Training Required
- 30-minute introductory session
- Hands-on practice with 2-3 bots
- Reference manual provided
- Quick-start guide laminated card

### Technical Support
- On-screen help available at each step
- FAQ section in application
- Technical support contact information

### Documentation Available
- Operator quick-start guide
- Detailed operator manual
- Troubleshooting guide
- System administrator guide

---

## Conclusion

The JaiaBot Pre-Flight Testing Infrastructure represents a significant improvement in the bot testing process. By automating data collection, providing clear guidance, and generating standardized reports, the system reduces operator workload while improving test quality and consistency. The automated nature of the system ensures that no critical checks are missed and provides complete documentation for regulatory compliance and quality assurance purposes.

---

**Document Control**
- **Author:** JaiaBot Development Team
- **Reviewed By:** Operations Team
- **Approved By:** Project Manager
- **Next Review Date:** March 2026