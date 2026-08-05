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
// Only resent for redundancy, in case a command is lost on the way to the bot
const MOTOR_RPM_TEST_COMMAND_INTERVAL = 2000; // milliseconds
// The bot stops the motor on its own this long after the last command it received, so keep it only
// long enough to ride out a few dropped commands
const MOTOR_RPM_TEST_COMMAND_TIMEOUT = 8; // seconds
// The stop is repeated, so a single dropped command can't leave the motor running
const MOTOR_RPM_TEST_STOP_COUNT = 3;
const MOTOR_RPM_TEST_STOP_INTERVAL = 500; // milliseconds
// The bot answers one engineering status per query, and a slow link can take seconds to deliver
// each one, so wait for those answers instead of assuming they arrive on our clock
const MOTOR_RPM_TEST_COLLECTION_TIMEOUT = 20000; // milliseconds
// A longer serial can't name a tail, so there is no point running the motor for one
const TAIL_SERIAL_MAX_LENGTH = 7; // characters

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

        this.tailSerialInput = byId("tail-serial");

        this.lastEngineeringStatusTime = 0;
        this.lastEngineeringStatusBotId = null;
        this.isMotorRPMTestRunning = false;
        this.isMotorRPMTestDriving = false;
        this.isCollectingMotorRPM = false;
        this.motorRPMSamples = [];
        this.motorRPMStatusCount = 0;
        this.motorRPMQueryCount = 0;
        this.motorRunningStatusCount = 0;
        this.motorRPMCollectionTimeout = null;
        this.motorRPMTailSerial = "";
        this.motorRPMBotId = null;
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

        // Each bot stamps this time from its own clock, so only compare within a single bot
        if (selected_bot_id !== this.lastEngineeringStatusBotId) {
            this.lastEngineeringStatusBotId = selected_bot_id;
            this.lastEngineeringStatusTime = 0;
        }

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

        // Results are filed against the tail, so there is nothing to record without a serial
        const tailSerial = this.tailSerialInput.value.trim();
        if (tailSerial === "") {
            alert("Please enter the tail serial first.");
            return;
        }

        if (tailSerial.length > TAIL_SERIAL_MAX_LENGTH) {
            alert(`Tail serials are at most ${TAIL_SERIAL_MAX_LENGTH} characters.`);
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

        this.isMotorRPMTestRunning = true;
        this.isMotorRPMTestDriving = true;
        this.isCollectingMotorRPM = false;
        this.motorRPMSamples = [];
        this.motorRPMStatusCount = 0;
        this.motorRPMQueryCount = 0;
        this.motorRunningStatusCount = 0;
        // Held for the report, so editing these during the test can't change what is recorded
        this.motorRPMTailSerial = tailSerial;
        this.motorRPMBotId = botId;
        this.updateTestMotorRPMBtn(true);
        this.updateMotorRPMTestResult("Spinning up motor...", "");
        this.updateMotorRPMTestUpload("", "");

        const testStartTime = Date.now();

        const runMotor = () => {
            // Nothing may drive the motor once the measurement window is over
            if (!this.isMotorRPMTestDriving) return;

            // Only ask for a status once we are measuring, to keep the link quiet before that.
            // Decided here rather than on its own timer, so the first measuring command is
            // guaranteed to carry the query.
            if (!this.isCollectingMotorRPM && Date.now() - testStartTime >= MOTOR_RPM_TEST_SPINUP) {
                this.isCollectingMotorRPM = true;
                this.updateMotorRPMTestResult("Measuring motor RPM...", "");
            }

            this.sendMotorRPMTestCommand(
                botId,
                {
                    timeout: MOTOR_RPM_TEST_COMMAND_TIMEOUT,
                    speed: { target: MOTOR_RPM_TEST_SPEED },
                },
                this.isCollectingMotorRPM,
            );
        };

        runMotor();
        const runMotorInterval = setInterval(runMotor, MOTOR_RPM_TEST_COMMAND_INTERVAL);

        setTimeout(() => {
            clearInterval(runMotorInterval);
            this.isMotorRPMTestDriving = false;
            this.stopMotor(botId);
            this.updateMotorRPMTestResult("Waiting for motor RPM data...", "");

            // The statuses were sampled while the motor was running, so they are still worth
            // waiting for now that it has stopped
            this.motorRPMCollectionTimeout = setTimeout(
                () => this.finishMotorRPMTest(),
                MOTOR_RPM_TEST_COLLECTION_TIMEOUT,
            );
        }, MOTOR_RPM_TEST_SPINUP + MOTOR_RPM_TEST_MEASURE);
    }

    stopMotor(botId) {
        // Don't query on the stop command, so the bot isn't asked for a status after it stops.
        // Send no timeout with it, so the bot goes back to its usual motor command failsafe.
        const sendStop = () => this.sendMotorRPMTestCommand(botId, { throttle: 0 }, false);

        sendStop();
        for (let resendIndex = 1; resendIndex < MOTOR_RPM_TEST_STOP_COUNT; resendIndex++) {
            setTimeout(sendStop, resendIndex * MOTOR_RPM_TEST_STOP_INTERVAL);
        }
    }

    finishMotorRPMTest() {
        if (!this.isMotorRPMTestRunning) return;

        clearTimeout(this.motorRPMCollectionTimeout);
        this.isCollectingMotorRPM = false;
        this.isMotorRPMTestRunning = false;
        this.reportMotorRPMTestResult();
        this.updateTestMotorRPMBtn(false);
    }

    sendMotorRPMTestCommand(botId, pidControl, isQueryingStatus) {
        const engineeringCommand = {
            bot_id: botId,
            pid_control: pidControl,
            query_engineering_status: isQueryingStatus,
        };

        if (isQueryingStatus) {
            this.motorRPMQueryCount += 1;
        }

        api.sendEngineeringCommand(engineeringCommand, true);
    }

    collectMotorRPMSample(engineeringStatus) {
        if (!this.isCollectingMotorRPM) return;

        this.motorRPMStatusCount += 1;

        // The throttle the bot reports is the one it was applying when it sampled the RPM, so it
        // tells us the motor was still being driven without comparing the bot's clock to ours
        if (engineeringStatus.pid_control?.throttle > 0) {
            this.motorRunningStatusCount += 1;

            if (engineeringStatus.motor_rpm != null) {
                this.motorRPMSamples.push(engineeringStatus.motor_rpm);
            }
        }

        // The bot answers each query with one status, so once they are all in there is nothing
        // left to wait for
        if (!this.isMotorRPMTestDriving && this.motorRPMStatusCount >= this.motorRPMQueryCount) {
            this.finishMotorRPMTest();
        }
    }

    reportMotorRPMTestResult() {
        if (this.motorRPMStatusCount === 0) {
            this.updateMotorRPMTestResult(
                "No engineering status was received from this bot. Check the link to the bot.",
                "motor-rpm-test-fail",
            );
            return;
        }

        if (this.motorRunningStatusCount === 0) {
            this.updateMotorRPMTestResult(
                `The motor never ran (${this.motorRPMStatusCount} engineering statuses received)`,
                "motor-rpm-test-fail",
            );
            return;
        }

        if (this.motorRPMSamples.length === 0) {
            this.updateMotorRPMTestResult(
                "The motor ran, but this bot never reported its motor RPM",
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

        this.submitMotorRPMTestResult(isPass, Math.round(averageRPM));
    }

    submitMotorRPMTestResult(isPass, averageRPM) {
        const testResult = {
            // Stays the same across retries, so the database can drop a result it already has
            external_id: `jed-${api.clientId}-${Date.now()}`,
            test_type: "motor_rpm",
            asset_type: "tail",
            tail_serial: this.motorRPMTailSerial,
            passed: isPass,
            summary: `${averageRPM} RPM (needs ${MOTOR_RPM_TEST_MIN_RPM})`,
            data: {
                average_rpm: averageRPM,
                threshold_rpm: MOTOR_RPM_TEST_MIN_RPM,
                samples: this.motorRPMSamples,
                bot_id: this.motorRPMBotId,
            },
            // This browser's clock, not the bot's
            performed_at: new Date().toISOString(),
            source: "jed",
        };

        this.updateMotorRPMTestUpload("Recording result...", "");

        api.submitTestResult(testResult).then((response) => {
            if (response.status === "ok") {
                this.updateMotorRPMTestUpload(
                    `Recorded for tail ${testResult.tail_serial}`,
                    "motor-rpm-test-pass",
                );
                return;
            }

            if (response.status === "queued") {
                this.updateMotorRPMTestUpload(
                    `Saved on this hub, waiting to reach the database ` +
                        `(${response.queued} waiting)`,
                    "",
                );
                return;
            }

            this.updateMotorRPMTestUpload(response.message, "motor-rpm-test-fail");
        });
    }

    updateMotorRPMTestUpload(uploadText, uploadClass) {
        let element = document.getElementById("motor-rpm-test-upload");
        element.textContent = uploadText;
        element.className = `motor-rpm-test-upload ${uploadClass}`;
    }

    updateMotorRPMTestResult(resultText, resultClass) {
        let element = document.getElementById("motor-rpm-test-result");
        element.textContent = resultText;
        element.className = `motor-rpm-test-result ${resultClass}`;
    }

    updateTestMotorRPMBtn(isTestRunning) {
        if (isTestRunning) {
            this.testMotorRPMButton.disabled = true;
            this.testMotorRPMButton.style.opacity = 0.5;
        } else {
            this.testMotorRPMButton.disabled = false;
            this.testMotorRPMButton.style.opacity = 1;
        }
    }
}

export const calibrationApp = new CalibrationApp();
