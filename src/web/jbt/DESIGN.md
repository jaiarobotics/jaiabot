# JaiaBot Pre-Flight Testing Infrastructure

## Design Document v1.0

---

## 1. Executive Summary

### Purpose

The JaiaBot Pre-Flight Testing Infrastructure (JBT) is a standalone web application that guides test operators through a comprehensive 10-step pre-flight checklist. The system automates data collection where possible and saves all results to fleet/bot-specific files, minimizing operator workload while ensuring thorough documentation.

### Key Goals

-   **Minimize Operator Work**: Automate sensor data collection from JCC
-   **Ensure Completeness**: Require confirmation for manual steps
-   **Maintain Records**: Save results to `fleet_#_bot_#_preflight_TIMESTAMP.json`
-   **Streamline Testing**: Guide operators through consistent workflow
-   **Standalone Operation**: Independent app on dedicated port 40012

### Target Users

-   Test operators performing pre-flight checks
-   Quality assurance personnel
-   Bot deployment teams

---

## 2. System Architecture

### 2.1 Overall Structure

```
┌─────────────────────────────────────────────────────────┐
│                    Operator Browser                      │
│              http://server:40012/jbt/                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Flask Server (Port 40012)                   │
│  Location: src/web/server/jbt_server.py                 │
│                                                          │
│  Routes:                                                 │
│  - GET  /jbt/              → Serve testing app          │
│  - GET  /jbt/api/status    → Get bot status from JCC   │
│  - GET  /jbt/api/sensors   → Get sensor data           │
│  - POST /jbt/api/save      → Save test results         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│            JCC Backend (Port 40001)                      │
│  Location: src/web/server/app.py                        │
│                                                          │
│  APIs Used:                                              │
│  - /jaia/v0/status-bots    → Bot status                │
│  - /jaia/v0/metadata       → Device metadata           │
└─────────────────────────────────────────────────────────┘

Frontend Stack (React + TypeScript):
src/web/jbt/
├── src/
│   ├── App.tsx                     → Main application
│   ├── index.tsx                   → Entry point
│   └── ui/
│       ├── TestingInterface.tsx   → Main wizard
│       ├── TestStep.tsx           → Individual test steps
│       ├── TestProgress.tsx       → Progress indicator
│       └── TestingInterface.css   → Styling
├── public/
│   └── index.html                 → HTML template
├── dist/                          → Build output
├── package.json                   → Dependencies
├── webpack.config.js              → Build configuration
└── tsconfig.json                  → TypeScript config
```

### 2.2 Data Flow

```
1. Operator opens http://server:40012/jbt/
2. App prompts for Fleet# and Bot#
3. For each test step:
   a. If automatable: Fetch data from JCC API
   b. If manual: Display instructions, require confirmation
   c. Store results in state
4. On completion: POST to /jbt/api/save
5. Server writes: /var/log/jaiabot/preflight/fleet_#_bot_#_preflight_TIMESTAMP.json
6. Display success message to operator
```

---

## 3. Pre-Flight Checklist Implementation

### 3.1 Test Steps Overview

| Step | Name                  | Type      | Automation               | Validation                 |
| ---- | --------------------- | --------- | ------------------------ | -------------------------- |
| 1    | Hub Battery Check     | Manual    | ❌                       | Confirmation required      |
| 2    | Tablet Setup          | Manual    | ❌                       | Confirmation required      |
| 3    | Motor & Rudder Bounds | Hybrid    | ✅ Fetch from JED        | Values must match expected |
| 4    | Sensor Readings       | Automated | ✅ Fetch from JCC        | Auto-save GPS/IMU/Sensors  |
| 5    | Battery Test          | Automated | ✅ Fetch from JCC status | Must be ≥75%               |
| 6    | Motor Status Check    | Automated | ✅ Fetch from Liaison    | Display RPM/Temp           |
| 7    | Motor Temperature     | Automated | ✅ From Step 6           | Must be >0°C               |
| 8    | RC Speed Tests        | Manual    | ❌                       | Confirmation required      |
| 9    | Rudder Tests          | Manual    | ❌                       | Confirmation required      |
| 10   | Propeller Security    | Manual    | ❌                       | Confirmation required      |

### 3.2 Step-by-Step Implementation

#### Step 1: Hub Battery Check (Manual)

**File**: `src/web/jbt/src/ui/TestStep.tsx` (case 1)

```typescript
// Operator confirms:
// - Hub has 2 or more solid lights
// - External battery brought if needed

// UI presents:
<div className="manual-step">
  <h4>Instructions:</h4>
  <ul>
    <li>Check hub battery indicator</li>
    <li>Verify 2 or more solid lights are lit</li>
    <li>If less than 2 lights, prepare external battery</li>
  </ul>
  <label>
    <input type="checkbox" required />
    I confirm the hub battery check is complete
  </label>
</div>
```

**Saved Data**:

```json
{
    "hub_battery_check": {
        "confirmed": true,
        "timestamp": "2026-02-26T20:00:00Z",
        "operator_notes": ""
    }
}
```

#### Step 2: Tablet Setup (Manual)

**File**: `src/web/jbt/src/ui/TestStep.tsx` (case 2)

```typescript
// Operator confirms:
// - Map tiles loaded in JCC
// - Tablet battery >75% or external battery ready

// Saved Data:
{
  "tablet_setup": {
    "map_tiles_loaded": true,
    "battery_sufficient": true,
    "timestamp": "2026-02-26T20:01:00Z"
  }
}
```

#### Step 3: Motor & Rudder Bounds (Hybrid)

**File**: `src/web/jbt/src/ui/TestStep.tsx` (case 3)

**Backend API**:

```python
# src/web/server/jbt_server.py
@app.route('/jbt/api/motor-bounds/<fleet_id>/<bot_id>', methods=['GET'])
def get_motor_bounds(fleet_id, bot_id):
    # Query JED for motor/rudder configuration
    # Returns current bounds for validation
    return jsonify({
        "forward_start": 1650,
        "reverse_start": 1410,
        "max_reverse": 1320,
        "throttle_zero_buoyancy": -35,
        "throttle_dive": -45,
        "throttle_ascent": 25,
        "timestamp": datetime.utcnow().isoformat()
    })
```

**Frontend**:

```typescript
// Auto-fetch on step load
useEffect(() => {
  fetch(`/jbt/api/motor-bounds/${fleetId}/${botId}`)
    .then(res => res.json())
    .then(data => {
      setBounds(data);
      // Validate against expected values
      validateBounds(data);
    });
}, [fleetId, botId]);

// Display with validation status
<div className="automated-step">
  <h4>Motor & Rudder Bounds (Auto-Retrieved)</h4>
  <table>
    <tr>
      <td>Forward Start:</td>
      <td className={bounds.forward_start === 1650 ? 'pass' : 'fail'}>
        {bounds.forward_start} (Expected: 1650)
      </td>
    </tr>
    {/* ... more rows ... */}
  </table>
</div>
```

**Saved Data**:

```json
{
    "motor_rudder_bounds": {
        "forward_start": 1650,
        "reverse_start": 1410,
        "max_reverse": 1320,
        "throttle_zero_buoyancy": -35,
        "throttle_dive": -45,
        "throttle_ascent": 25,
        "validation_passed": true,
        "timestamp": "2026-02-26T20:02:00Z",
        "source": "JED API"
    }
}
```

#### Step 4: JCC Sensor Readings (Automated)

**File**: `src/web/jbt/src/ui/TestStep.tsx` (case 4)

**Backend API**:

```python
# src/web/server/jbt_server.py
@app.route('/jbt/api/sensors/<fleet_id>/<bot_id>', methods=['GET'])
def get_sensor_readings(fleet_id, bot_id):
    # Query JCC for current sensor data
    # Uses existing /jaia/v0/status-bots endpoint
    bot_status = jaia_interface.get_status_bots()
    bot_key = f"{fleet_id}_{bot_id}"

    if bot_key not in bot_status:
        return jsonify({"error": "Bot not found"}), 404

    bot = bot_status[bot_key]

    return jsonify({
        "gps": {
            "latitude": bot.get("location", {}).get("lat"),
            "longitude": bot.get("location", {}).get("lon"),
            "fix_quality": bot.get("location", {}).get("fix_quality"),
            "satellites": bot.get("location", {}).get("satellites")
        },
        "imu": {
            "heading": bot.get("attitude", {}).get("heading"),
            "pitch": bot.get("attitude", {}).get("pitch"),
            "roll": bot.get("attitude", {}).get("roll"),
            "calibration_status": bot.get("calibration", {}).get("status")
        },
        "sensors": {
            "temperature": bot.get("temperature"),
            "pressure": bot.get("pressure"),
            "salinity": bot.get("salinity"),
            "depth": bot.get("depth")
        },
        "timestamp": datetime.utcnow().isoformat()
    })
```

**Frontend**:

```typescript
// Auto-fetch and display
useEffect(() => {
  fetch(`/jbt/api/sensors/${fleetId}/${botId}`)
    .then(res => res.json())
    .then(data => {
      setSensorData(data);
    });
}, [fleetId, botId]);

// NO screenshot needed - data automatically saved
<div className="automated-step">
  <h4>Sensor Readings (Auto-Retrieved from JCC)</h4>
  <div className="sensor-grid">
    <div className="sensor-section">
      <h5>GPS</h5>
      <p>Latitude: {sensorData.gps.latitude}</p>
      <p>Longitude: {sensorData.gps.longitude}</p>
      <p>Fix Quality: {sensorData.gps.fix_quality}</p>
      <p>Satellites: {sensorData.gps.satellites}</p>
    </div>
    <div className="sensor-section">
      <h5>IMU</h5>
      <p>Heading: {sensorData.imu.heading}°</p>
      <p>Pitch: {sensorData.imu.pitch}°</p>
      <p>Roll: {sensorData.imu.roll}°</p>
      <p>Calibration: {sensorData.imu.calibration_status}</p>
    </div>
    <div className="sensor-section">
      <h5>Sensors</h5>
      <p>Temperature: {sensorData.sensors.temperature}°C</p>
      <p>Pressure: {sensorData.sensors.pressure} bar</p>
      <p>Salinity: {sensorData.sensors.salinity} PSU</p>
      <p>Depth: {sensorData.sensors.depth} m</p>
    </div>
  </div>
  <p className="auto-note">✓ Data automatically saved to test report</p>
</div>
```

**Saved Data**:

```json
{
    "sensor_readings": {
        "gps": {
            "latitude": 41.5286,
            "longitude": -70.673,
            "fix_quality": "GPS Fix",
            "satellites": 12
        },
        "imu": {
            "heading": 45.2,
            "pitch": 0.1,
            "roll": -0.3,
            "calibration_status": 3
        },
        "sensors": {
            "temperature": 12.5,
            "pressure": 1.013,
            "salinity": 32.1,
            "depth": 0.2
        },
        "timestamp": "2026-02-26T20:03:00Z",
        "source": "JCC API"
    }
}
```

#### Step 5: Battery Test (Automated)

**Backend API**:

```python
@app.route('/jbt/api/battery/<fleet_id>/<bot_id>', methods=['GET'])
def get_battery_status(fleet_id, bot_id):
    bot_status = jaia_interface.get_status_bots()
    bot_key = f"{fleet_id}_{bot_id}"
    bot = bot_status.get(bot_key, {})

    battery_percent = bot.get("battery_percent", 0)

    return jsonify({
        "battery_percent": battery_percent,
        "passed": battery_percent >= 75,
        "timestamp": datetime.utcnow().isoformat()
    })
```

**Saved Data**:

```json
{
    "battery_test": {
        "battery_percent": 85,
        "passed": true,
        "threshold": 75,
        "timestamp": "2026-02-26T20:04:00Z",
        "source": "JCC API"
    }
}
```

#### Step 6-7: Motor Status & Temperature (Automated)

**Backend API**:

```python
@app.route('/jbt/api/motor/<fleet_id>/<bot_id>', methods=['GET'])
def get_motor_status(fleet_id, bot_id):
    # Query Liaison (10.23.fleet#.100+Bot_ID:30000)
    # Uses existing bot status data
    bot_status = jaia_interface.get_status_bots()
    bot_key = f"{fleet_id}_{bot_id}"
    bot = bot_status.get(bot_key, {})

    return jsonify({
        "rpm": bot.get("motor_rpm", 0),
        "temperature": bot.get("motor_temperature", 0),
        "timestamp": datetime.utcnow().isoformat()
    })
```

**Saved Data**:

```json
{
    "motor_status": {
        "rpm": 1200,
        "temperature": 28.5,
        "temperature_passed": true,
        "timestamp": "2026-02-26T20:05:00Z",
        "source": "Liaison API"
    }
}
```

#### Steps 8-10: RC/Rudder/Propeller Tests (Manual)

**Implementation**: Similar to Steps 1-2, operator confirms completion

**Saved Data**:

```json
{
    "rc_speed_tests": {
        "speed_1_tested": true,
        "speed_2_tested": true,
        "reverse_speed_1_tested": true,
        "operator_confirmed": true,
        "timestamp": "2026-02-26T20:06:00Z"
    },
    "rudder_tests": {
        "starboard_3_tested": true,
        "port_3_tested": true,
        "centered_tested": true,
        "operator_confirmed": true,
        "timestamp": "2026-02-26T20:07:00Z"
    },
    "propeller_security": {
        "sounds_secure": true,
        "operator_confirmed": true,
        "timestamp": "2026-02-26T20:08:00Z"
    }
}
```

---

## 4. File Output Format

### 4.1 Output Location

```
/var/log/jaiabot/preflight/
└── fleet_<FLEET#>_bot_<BOT#>_preflight_<TIMESTAMP>.json
```

Example: `/var/log/jaiabot/preflight/fleet_1_bot_3_preflight_20260226_200900.json`

### 4.2 Complete File Structure

```json
{
    "metadata": {
        "fleet_id": 1,
        "bot_id": 3,
        "test_started": "2026-02-26T20:00:00Z",
        "test_completed": "2026-02-26T20:09:00Z",
        "operator": "operator_name",
        "test_version": "1.0",
        "all_tests_passed": true
    },
    "test_results": {
        "hub_battery_check": {
            /* ... */
        },
        "tablet_setup": {
            /* ... */
        },
        "motor_rudder_bounds": {
            /* ... */
        },
        "sensor_readings": {
            /* ... */
        },
        "battery_test": {
            /* ... */
        },
        "motor_status": {
            /* ... */
        },
        "rc_speed_tests": {
            /* ... */
        },
        "rudder_tests": {
            /* ... */
        },
        "propeller_security": {
            /* ... */
        }
    },
    "summary": {
        "total_tests": 10,
        "automated_tests": 4,
        "manual_tests": 6,
        "tests_passed": 10,
        "tests_failed": 0,
        "critical_failures": []
    }
}
```

---

## 5. Server Configuration

### 5.1 New Server File

**Location**: `src/web/server/jbt_server.py`

```python
#!/usr/bin/env python3
"""
JaiaBot Testing Server
Runs on port 40012, serves testing interface and APIs
"""

import argparse
import json
import logging
import os
from datetime import datetime
from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS

# Import existing jaia_portal for bot status
import sys
sys.path.append(os.path.dirname(__file__))
import jaia_portal

# Arguments
parser = argparse.ArgumentParser()
parser.add_argument("hostname", type=str, nargs="?",
                    default=os.environ.get("JCC_HUB_IP", "localhost"))
parser.add_argument("-p", dest='port', type=int, default=40000)
parser.add_argument("-l", dest='logLevel', type=str, default='INFO')
parser.add_argument("-a", dest='appRoot', type=str, default='../')
args = parser.parse_args()

# Setup logging
logging.basicConfig(level=getattr(logging, args.logLevel.upper()))
logger = logging.getLogger(__name__)

# Connect to Goby interface
jaia_interface = jaia_portal.Interface(
    goby_host=(args.hostname, args.port),
    read_only=True
)

app = Flask(__name__)
CORS(app)  # Enable CORS for API calls

# Paths
jbt_dist = os.path.join(args.appRoot, 'jbt/dist')
output_dir = '/var/log/jaiabot/preflight'
os.makedirs(output_dir, exist_ok=True)

####### Static Files #######

@app.route('/jbt/', methods=['GET'])
@app.route('/jbt', methods=['GET'])
def serve_app():
    return send_from_directory(jbt_dist, 'index.html')

@app.route('/jbt/<path:path>', methods=['GET'])
def serve_static(path):
    return send_from_directory(jbt_dist, path)

####### API Endpoints #######

@app.route('/jbt/api/fleet-bots', methods=['GET'])
def get_fleet_bots():
    """Get list of available fleets and bots"""
    try:
        bots = jaia_interface.get_status_bots()
        fleet_bot_list = []
        for bot_key in bots.keys():
            parts = bot_key.split('_')
            if len(parts) == 2:
                fleet_bot_list.append({
                    "fleet_id": int(parts[0]),
                    "bot_id": int(parts[1])
                })
        return jsonify({"bots": fleet_bot_list})
    except Exception as e:
        logger.error(f"Error getting fleet bots: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/jbt/api/motor-bounds/<int:fleet_id>/<int:bot_id>', methods=['GET'])
def get_motor_bounds(fleet_id, bot_id):
    """Get motor and rudder bounds from bot configuration"""
    # Implementation as shown in section 3.2
    pass

@app.route('/jbt/api/sensors/<int:fleet_id>/<int:bot_id>', methods=['GET'])
def get_sensors(fleet_id, bot_id):
    """Get sensor readings from JCC"""
    # Implementation as shown in section 3.2
    pass

@app.route('/jbt/api/battery/<int:fleet_id>/<int:bot_id>', methods=['GET'])
def get_battery(fleet_id, bot_id):
    """Get battery status"""
    # Implementation as shown in section 3.2
    pass

@app.route('/jbt/api/motor/<int:fleet_id>/<int:bot_id>', methods=['GET'])
def get_motor(fleet_id, bot_id):
    """Get motor status and temperature"""
    # Implementation as shown in section 3.2
    pass

@app.route('/jbt/api/save-results', methods=['POST'])
def save_results():
    """Save test results to file"""
    try:
        data = request.json
        fleet_id = data['metadata']['fleet_id']
        bot_id = data['metadata']['bot_id']
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        filename = f"fleet_{fleet_id}_bot_{bot_id}_preflight_{timestamp}.json"
        filepath = os.path.join(output_dir, filename)

        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)

        logger.info(f"Saved test results to {filepath}")
        return jsonify({
            "success": True,
            "filename": filename,
            "filepath": filepath
        })
    except Exception as e:
        logger.error(f"Error saving results: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=40012, debug=False)
```

### 5.2 Running the Server

**Manual Start**:

```bash
cd src/web/server
python3 jbt_server.py <hub_ip>
```

**Systemd Service** (for production):
Create `/etc/systemd/system/jaiabot-testing.service`:

```ini
[Unit]
Description=JaiaBot Pre-Flight Testing Server
After=network.target

[Service]
Type=simple
User=jaiabot
WorkingDirectory=/home/jaiabot/src/web/server
Environment="JCC_HUB_IP=10.23.1.10"
ExecStart=/usr/bin/python3 jbt_server.py
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable jaiabot-testing
sudo systemctl start jaiabot-testing
```

### 5.3 Accessing the App

```
http://10.23.1.10:40012/jbt/
```

---

## 6. Frontend Enhancements

### 6.1 Add Fleet/Bot Selection

**Location**: `src/web/jbt/src/App.tsx`

```typescript
import React, { useState, useEffect } from "react";
import { TestingInterface } from "./ui/TestingInterface";
import "./App.css";

export const App: React.FC = () => {
    const [fleetId, setFleetId] = useState<number | null>(null);
    const [botId, setBotId] = useState<number | null>(null);
    const [availableBots, setAvailableBots] = useState<any[]>([]);

    useEffect(() => {
        fetch('/jbt/api/fleet-bots')
            .then(res => res.json())
            .then(data => setAvailableBots(data.bots));
    }, []);

    if (!fleetId || !botId) {
        return (
            <div className="app-container">
                <div className="bot-selector">
                    <h2>Select Bot for Testing</h2>
                    <select onChange={(e) => {
                        const [f, b] = e.target.value.split('_');
                        setFleetId(parseInt(f));
                        setBotId(parseInt(b));
                    }}>
                        <option value="">-- Select Bot --</option>
                        {availableBots.map(bot => (
                            <option key={`${bot.fleet_id}_${bot.bot_id}`}
                                    value={`${bot.fleet_id}_${bot.bot_id}`}>
                                Fleet {bot.fleet_id} - Bot {bot.bot_id}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <TestingInterface fleetId={fleetId} botId={botId} />
        </div>
    );
};
```

### 6.2 Update TestingInterface

**Location**: `src/web/jbt/src/ui/TestingInterface.tsx`

Add props and API calls:

```typescript
export interface TestingInterfaceProps {
    fleetId: number;
    botId: number;
}

export const TestingInterface: React.FC<TestingInterfaceProps> = ({ fleetId, botId }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [testResults, setTestResults] = useState<any>({
        metadata: {
            fleet_id: fleetId,
            bot_id: botId,
            test_started: new Date().toISOString(),
            operator: "operator_name", // Could prompt for this
        },
    });

    // Auto-fetch data for automated steps
    useEffect(() => {
        const currentTest = tests[currentStep];
        if (currentTest.automated) {
            fetchStepData(currentTest.id);
        }
    }, [currentStep]);

    const fetchStepData = async (stepId: number) => {
        let endpoint = "";
        switch (stepId) {
            case 3:
                endpoint = `/jbt/api/motor-bounds/${fleetId}/${botId}`;
                break;
            case 4:
                endpoint = `/jbt/api/sensors/${fleetId}/${botId}`;
                break;
            case 5:
                endpoint = `/jbt/api/battery/${fleetId}/${botId}`;
                break;
            case 6:
            case 7:
                endpoint = `/jbt/api/motor/${fleetId}/${botId}`;
                break;
        }

        if (endpoint) {
            const response = await fetch(endpoint);
            const data = await response.json();
            setTestResults((prev) => ({
                ...prev,
                [`step_${stepId}`]: data,
            }));
        }
    };

    const handleFinish = async () => {
        // Add completion metadata
        const finalResults = {
            ...testResults,
            metadata: {
                ...testResults.metadata,
                test_completed: new Date().toISOString(),
            },
        };

        // Save to server
        const response = await fetch("/jbt/api/save-results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalResults),
        });

        const result = await response.json();
        if (result.success) {
            alert(`Test results saved to: ${result.filename}`);
            setCompleted(true);
        }
    };

    // ... rest of implementation
};
```

---

## 7. Operator Workflow

### 7.1 Test Procedure

1. **Navigate to Testing App**

    ```
    http://10.23.1.10:40012/jbt/
    ```

2. **Select Bot**

    - Choose Fleet # and Bot # from dropdown
    - System loads bot-specific data

3. **Complete 10-Step Checklist**

    **Automated Steps (4, 6, 7):**

    - Data automatically fetched and displayed
    - Operator reviews values
    - Click "Next" to proceed

    **Hybrid Steps (3, 5):**

    - Data fetched, validation performed
    - Green/Red indicators show pass/fail
    - Operator reviews, clicks "Next"

    **Manual Steps (1, 2, 8, 9, 10):**

    - Operator reads instructions
