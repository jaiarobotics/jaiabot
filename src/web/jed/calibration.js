import "./calibration.css";
import { byId } from "./domQuery.js";
import { api, JaiaAPI } from "./api.js";
import { updateStatus } from "./updateStatus.js";
import { botDropdown } from "./BotDropdown.js";
import { ActuatorConfigSlider } from "./ActuatorConfigSlider.js";
import { ActuatorConfigTextInputs } from "./ActuatorConfigTextInputs.js";

const MOTOR_RPM_TEST_SPEED = 1; // meters/second
const MOTOR_RPM_TEST_MIN_RPM = 3600;
// The motor runs this long before any RPM is sampled, so it has spun up to a steady speed
const MOTOR_RPM_TEST_SPINUP = 10000; // milliseconds
// RPM is sampled over this window, after the motor has spun up
const MOTOR_RPM_TEST_MEASURE = 5000; // milliseconds
// Must stay under 1 second, so the api throttle keeps suppressing the periodic zero throttle command
const MOTOR_RPM_TEST_COMMAND_INTERVAL = 500; // milliseconds
const MOTOR_RPM_TEST_COLLECTION_GRACE = 3000; // milliseconds
// The bot stops the motor itself this long after the last command, if the test is interrupted
const MOTOR_RPM_TEST_COMMAND_TIMEOUT = 5; // seconds

class CalibrationApp {
    constructor() {
        this.defaultBounds = {
            motor: {
                forwardStart: 1600,
                reverseStart: 1400,
                max_reverse: 1320,
                throttle_zero_net_buoyancy: -35,
                throttle_dive: -35,
                throttle_ascent: 25,
            },
            rudder: {
                upper: 1100,
                lower: 1900,
                center: 1500,
            },
        };

        this.motorConfigControl = new ActuatorConfigTextInputs(
            "motor-bounds-config",
            this.defaultBounds.motor,
        );
        this.rudderConfigControl = new ActuatorConfigTextInputs(
            "rudder-bounds-config",
            this.defaultBounds.rudder,
        );

        this.submitButton = byId("submit-config");
        this.submitButton.addEventListener("click", this.submitConfig.bind(this));

        this.queryButton = byId("query-engineering-status");
        this.queryButton.addEventListener("click", this.queryEngineeringStatus.bind(this));

        this.startIMUCalButton = byId("imu-cal-start-btn");
        this.startIMUCalButton.addEventListener("click", this.startIMUCalibration.bind(this));

        this.testMotorRPMButton = byId("test-motor-rpm-btn");
        this.testMotorRPMButton.addEventListener("click", this.testMotorRPM.bind(this));

        this.lastEngineeringStatusTime = 0;
        this.isCollectingMotorRPM = false;
        this.motorRPMSamples = [];
        this.motorRPMStatusCount = 0;
    }

    updateStatus(status) {
        // Update bounds, if the time is newer on this engineering status
        const selected_bot_id = botDropdown.getSelectedBotId();
        if (selected_bot_id == null) return;

        const thisBot = status.bots[botDropdown.getSelectedBotId()];
        if (thisBot == null) return;

        this.updateIMUCurrentCalibration(thisBot["calibration_status"]);
        this.updateIMUCalibrationState(thisBot["calibration_state"]);
        this.updateIMUCalibrationBtn(thisBot["calibration_state"]);

        const engineering_status = thisBot.engineering;
        if (engineering_status == null) return;

        const engineeringStatusTime = Number(engineering_status.time);
        if (engineeringStatusTime <= this.lastEngineeringStatusTime) return;
        this.lastEngineeringStatusTime = engineeringStatusTime;

        this.collectMotorRPMSample(engineering_status);

        const bounds = engineering_status.bounds;
        if (bounds == null) return;

        this.motorConfigControl.setConfig(bounds.motor);
        this.rudderConfigControl.setConfig(bounds.rudder);
    }

    submitConfig(event) {
        const bot_id = botDropdown.getSelectedBotId();
        if (bot_id == null) {
            alert("Please select a bot first");
            return;
        }

        if (!api.inControl) {
            alert(
                "We are not in control yet.  Please press 'Take Control' if you'd like to take control.",
            );
            return;
        }

        const engineeringCommand = {
            bot_id: bot_id,
            bounds: {
                motor: this.motorConfigControl.getConfig(),
                rudder: this.rudderConfigControl.getConfig(),
            },
        };

        api.sendEngineeringCommand(engineeringCommand, true);
    }

    queryEngineeringStatus(event) {
        const bot_id = botDropdown.getSelectedBotId();
        if (bot_id == null) {
            alert("Please select a bot first");
            return;
        }

        if (!api.inControl) {
            alert(
                "We are not in control yet.  Please press 'Take Control' if you'd like to take control.",
            );
            return;
        }

        const engineeringCommand = {
            bot_id: bot_id,
            query_engineering_status: true,
        };

        api.sendEngineeringCommand(engineeringCommand, true);
    }

    startIMUCalibration() {
        const botId = botDropdown.getSelectedBotId();
        if (botId === "0") {
            alert("Please select a bot first.");
            return;
        }

        if (!api.inControl) {
            alert(
                "We are not in control yet. Please press 'Take Control' if you'd like to take control.",
            );
            return;
        }

        const engineeringCommand = {
            bot_id: botId,
            imu_cal: {
                run_cal: true,
            },
        };
        api.sendEngineeringCommand(engineeringCommand, true);
    }

    updateIMUCurrentCalibration(currentCalibration) {
        let element = document.getElementById("imu-cal-current");
        element.textContent = currentCalibration;
    }

    updateIMUCalibrationState(calibrationState) {
        let element = document.getElementById("imu-cal-state");
        switch (calibrationState) {
            case "IN_PROGRESS":
                element.textContent = "IMU Calibration In Progress...";
                break;
            case "COMPLETE":
                element.textContent = "IMU Calibration Complete";
                break;
            default:
                element.textContent = "";
        }
    }

    updateIMUCalibrationBtn(calibrationState) {
        let element = document.getElementById("imu-cal-start-btn");
        if (calibrationState === "IN_PROGRESS") {
            element.disabled = true;
            element.style.opacity = 0.9;
        } else {
            element.disabled = false;
            element.style.opacity = 1;
        }
    }

    testMotorRPM() {
        const botId = botDropdown.getSelectedBotId();
        if (botId === "0") {
            alert("Please select a bot first.");
            return;
        }

        if (!api.inControl) {
            alert(
                "We are not in control yet. Please press 'Take Control' if you'd like to take control.",
            );
            return;
        }

        if (
            !confirm(
                `The motor on bot ${botId} will run at ${MOTOR_RPM_TEST_SPEED} m/s for ` +
                    `${(MOTOR_RPM_TEST_SPINUP + MOTOR_RPM_TEST_MEASURE) / 1000} seconds. Confirm ` +
                    `that you and everyone else are clear of the propeller before continuing.`,
            )
        ) {
            return;
        }

        this.isCollectingMotorRPM = false;
        this.motorRPMSamples = [];
        this.motorRPMStatusCount = 0;
        this.updateTestMotorRPMBtn(true);
        this.updateMotorRPMTestResult("Spinning up motor...", "");

        const runMotor = () =>
            this.sendMotorRPMTestCommand(
                botId,
                {
                    timeout: MOTOR_RPM_TEST_COMMAND_TIMEOUT,
                    speed: { target: MOTOR_RPM_TEST_SPEED },
                },
                true,
            );

        runMotor();
        const runMotorInterval = setInterval(runMotor, MOTOR_RPM_TEST_COMMAND_INTERVAL);

        setTimeout(() => {
            this.isCollectingMotorRPM = true;
            this.updateMotorRPMTestResult("Measuring motor RPM...", "");
        }, MOTOR_RPM_TEST_SPINUP);

        setTimeout(() => {
            clearInterval(runMotorInterval);
            // Don't query on the stop command, so the bot isn't asked for a status after it stops
            this.sendMotorRPMTestCommand(
                botId,
                { timeout: MOTOR_RPM_TEST_COMMAND_TIMEOUT, throttle: 0 },
                false,
            );
            this.updateMotorRPMTestResult("Waiting for motor RPM data...", "");
        }, MOTOR_RPM_TEST_SPINUP + MOTOR_RPM_TEST_MEASURE);

        // The bot only sends an engineering status every couple of seconds, so keep listening for
        // the statuses it sent while the motor was still running
        setTimeout(
            () => {
                this.isCollectingMotorRPM = false;
                this.reportMotorRPMTestResult();
                this.updateTestMotorRPMBtn(false);
            },
            MOTOR_RPM_TEST_SPINUP + MOTOR_RPM_TEST_MEASURE + MOTOR_RPM_TEST_COLLECTION_GRACE,
        );
    }

    sendMotorRPMTestCommand(botId, pidControl, isQueryingStatus) {
        const engineeringCommand = {
            bot_id: botId,
            pid_control: pidControl,
            query_engineering_status: isQueryingStatus,
        };

        api.sendEngineeringCommand(engineeringCommand, true);
    }

    collectMotorRPMSample(engineeringStatus) {
        if (!this.isCollectingMotorRPM) return;

        this.motorRPMStatusCount += 1;

        if (engineeringStatus.motor_rpm == null) return;

        // The throttle the bot reports is the one it was applying when it sampled the RPM, so it
        // tells us the motor was still being driven without comparing the bot's clock to ours
        if (!(engineeringStatus.pid_control?.throttle > 0)) return;

        this.motorRPMSamples.push(engineeringStatus.motor_rpm);
    }

    reportMotorRPMTestResult() {
        if (this.motorRPMSamples.length === 0) {
            this.updateMotorRPMTestResult(
                `No motor RPM recorded (${this.motorRPMStatusCount} engineering statuses received)`,
                "motor-rpm-test-fail",
            );
            return;
        }

        const averageRPM =
            this.motorRPMSamples.reduce((total, rpm) => total + rpm, 0) /
            this.motorRPMSamples.length;
        const isPass = averageRPM >= MOTOR_RPM_TEST_MIN_RPM;

        this.updateMotorRPMTestResult(
            `${isPass ? "PASS" : "FAIL"}: ${averageRPM.toFixed(0)} RPM ` +
                `(needs ${MOTOR_RPM_TEST_MIN_RPM} RPM)`,
            isPass ? "motor-rpm-test-pass" : "motor-rpm-test-fail",
        );
    }

    updateMotorRPMTestResult(resultText, resultClass) {
        let element = document.getElementById("motor-rpm-test-result");
        element.textContent = resultText;
        element.className = `motor-rpm-test-result ${resultClass}`;
    }

    updateTestMotorRPMBtn(isTestRunning) {
        if (isTestRunning) {
            this.testMotorRPMButton.disabled = true;
            this.testMotorRPMButton.style.opacity = 0.9;
        } else {
            this.testMotorRPMButton.disabled = false;
            this.testMotorRPMButton.style.opacity = 1;
        }
    }
}

export const calibrationApp = new CalibrationApp();
