import { useContext, useEffect, useRef, useState } from "react";
import { JaiaContext } from "../../../context/JaiaContext";
import { jaiaAPI, TestResult } from "../../../utils/jaia-api";
import { Engineering } from "../../../types/protobuf-types";

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
// A longer serial can't name a tail, so there is no point recording a result against one
const TAIL_SERIAL_MAX_LENGTH = 7; // characters

interface Props {
    botID: number;
}

interface TestMessage {
    text: string;
    style: string;
}

interface TestRun {
    isRunning: boolean;
    isDriving: boolean;
    isCollecting: boolean;
    samples: number[];
    statusCount: number;
    queryCount: number;
    runningStatusCount: number;
    lastStatusTime: number;
    tailSerial: string;
    operatorName: string;
    botID: number;
    botVIN: string;
    commandInterval: ReturnType<typeof setInterval>;
    collectionTimeout: ReturnType<typeof setTimeout>;
}

/**
 * Runs the motor at a fixed speed and reports the RPM it reached, optionally recording the
 * outcome against a tail in the Jaia database
 */
export default function MotorRPMTest(props: Props) {
    const jaiaContext = useContext(JaiaContext);
    const [tailSerial, setTailSerial] = useState("");
    const [operatorName, setOperatorName] = useState("");
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<TestMessage>({ text: "", style: "" });
    const [upload, setUpload] = useState<TestMessage>({ text: "", style: "" });
    const run = useRef<TestRun>(null);

    // Keep reading the bot under test even if the selection changes part way through, so a
    // running test can't start sampling a bot whose motor it never commanded
    const sampledBotID = run.current?.isRunning ? run.current.botID : props.botID;
    const engineering = jaiaContext.bots.getBot(sampledBotID)?.getEngineering();

    useEffect(() => {
        collectSample(engineering);
    }, [engineering?.time]);

    // Timers outlive a closed settings panel, and would otherwise report into nothing
    useEffect(() => {
        return () => {
            clearInterval(run.current?.commandInterval);
            clearTimeout(run.current?.collectionTimeout);
        };
    }, []);

    /**
     * Drives the motor, samples the RPM it settles at, then stops it
     *
     * @returns {void}
     */
    const handleTestMotorRPMClick = async () => {
        if (!props.botID) {
            return;
        }

        const takeControl = await jaiaAPI.takeControl();
        if (!takeControl || takeControl.status !== "ok") {
            return;
        }

        if (
            !confirm(
                `The motor on Bot ${props.botID} will run at ${MOTOR_RPM_TEST_SPEED} m/s for ` +
                    `${(MOTOR_RPM_TEST_SPINUP + MOTOR_RPM_TEST_MEASURE) / 1000} seconds. Confirm ` +
                    `that you and everyone else are clear of the propeller before continuing.`,
            )
        ) {
            return;
        }

        run.current = {
            isRunning: true,
            isDriving: true,
            isCollecting: false,
            samples: [],
            statusCount: 0,
            queryCount: 0,
            runningStatusCount: 0,
            lastStatusTime: 0,
            // Held for the report, so editing these during the test can't change what is recorded
            tailSerial: tailSerial.trim(),
            operatorName: operatorName.trim(),
            botID: props.botID,
            botVIN: "",
            commandInterval: null,
            collectionTimeout: null,
        };

        setIsRunning(true);
        setResult({ text: "Spinning up motor...", style: "" });
        setUpload({ text: "", style: "" });

        const testStartTime = Date.now();

        const runMotor = () => {
            // Nothing may drive the motor once the measurement window is over
            if (!run.current.isDriving) {
                return;
            }

            // Only ask for a status once we are measuring, to keep the link quiet before that.
            // Decided here rather than on its own timer, so the first measuring command is
            // guaranteed to carry the query.
            if (!run.current.isCollecting && Date.now() - testStartTime >= MOTOR_RPM_TEST_SPINUP) {
                run.current.isCollecting = true;
                setResult({ text: "Measuring motor RPM...", style: "" });
            }

            sendTestCommand(
                {
                    timeout: MOTOR_RPM_TEST_COMMAND_TIMEOUT,
                    speed: { target: MOTOR_RPM_TEST_SPEED },
                },
                run.current.isCollecting,
            );
        };

        runMotor();
        run.current.commandInterval = setInterval(runMotor, MOTOR_RPM_TEST_COMMAND_INTERVAL);

        setTimeout(() => {
            clearInterval(run.current.commandInterval);
            run.current.isDriving = false;
            stopMotor();
            setResult({ text: "Waiting for motor RPM data...", style: "" });

            // The statuses were sampled while the motor was running, so they are still worth
            // waiting for now that it has stopped
            run.current.collectionTimeout = setTimeout(
                () => finishTest(),
                MOTOR_RPM_TEST_COLLECTION_TIMEOUT,
            );
        }, MOTOR_RPM_TEST_SPINUP + MOTOR_RPM_TEST_MEASURE);
    };

    /**
     * Commands the motor to stop, repeatedly, so one lost command can't leave it running
     *
     * @returns {void}
     */
    const stopMotor = () => {
        // Don't query on the stop command, so the bot isn't asked for a status after it stops.
        // Send no timeout with it, so the bot goes back to its usual motor command failsafe.
        const sendStop = () => sendTestCommand({ throttle: 0 }, false);

        sendStop();
        for (let resendIndex = 1; resendIndex < MOTOR_RPM_TEST_STOP_COUNT; resendIndex++) {
            setTimeout(sendStop, resendIndex * MOTOR_RPM_TEST_STOP_INTERVAL);
        }
    };

    /**
     * Sends one engineering command to the bot under test
     *
     * @param {Engineering["pid_control"]} pidControl What the motor should be doing
     * @param {boolean} isQueryingStatus Whether to ask the bot to report back
     * @returns {void}
     */
    const sendTestCommand = (pidControl: Engineering["pid_control"], isQueryingStatus: boolean) => {
        if (isQueryingStatus) {
            run.current.queryCount += 1;
        }

        jaiaAPI.postEngineering({
            bot_id: run.current.botID,
            pid_control: pidControl,
            query_engineering_status: isQueryingStatus,
        });
    };

    /**
     * Takes the RPM out of an engineering status, if it arrived while the motor was running
     *
     * @param {Engineering} engineeringStatus The status just reported by the bot
     * @returns {void}
     */
    const collectSample = (engineeringStatus: Engineering) => {
        if (!run.current?.isCollecting || !engineeringStatus) {
            return;
        }

        // Each bot stamps this time from its own clock, so only compare within a single bot
        const statusTime = Number(engineeringStatus.time);
        if (statusTime <= run.current.lastStatusTime) {
            return;
        }
        run.current.lastStatusTime = statusTime;

        run.current.statusCount += 1;

        if (engineeringStatus.bot_vin != null) {
            run.current.botVIN = engineeringStatus.bot_vin;
        }

        // The throttle the bot reports is the one it was applying when it sampled the RPM, so it
        // tells us the motor was still being driven without comparing the bot's clock to ours
        if (engineeringStatus.pid_control?.throttle > 0) {
            run.current.runningStatusCount += 1;

            if (engineeringStatus.motor_rpm != null) {
                run.current.samples.push(engineeringStatus.motor_rpm);
            }
        }

        // The bot answers each query with one status, so once they are all in there is nothing
        // left to wait for
        if (!run.current.isDriving && run.current.statusCount >= run.current.queryCount) {
            finishTest();
        }
    };

    /**
     * Ends the test and reports what the motor did
     *
     * @returns {void}
     */
    const finishTest = () => {
        if (!run.current?.isRunning) {
            return;
        }

        clearTimeout(run.current.collectionTimeout);
        run.current.isCollecting = false;
        run.current.isRunning = false;
        setIsRunning(false);
        reportResult();
    };

    /**
     * Works out whether the motor reached the required RPM and shows the outcome
     *
     * @returns {void}
     */
    const reportResult = () => {
        if (run.current.statusCount === 0) {
            setResult({
                text: "No engineering status was received from this bot. Check the link to the bot.",
                style: "motor-rpm-test-fail",
            });
            return;
        }

        if (run.current.runningStatusCount === 0) {
            setResult({
                text: `The motor never ran (${run.current.statusCount} engineering statuses received)`,
                style: "motor-rpm-test-fail",
            });
            return;
        }

        if (run.current.samples.length === 0) {
            setResult({
                text: "The motor ran, but this bot never reported its motor RPM",
                style: "motor-rpm-test-fail",
            });
            return;
        }

        const averageRPM = Math.round(
            run.current.samples.reduce((total, rpm) => total + rpm, 0) / run.current.samples.length,
        );
        const isPass = averageRPM >= MOTOR_RPM_TEST_MIN_RPM;

        setResult({
            text: `${isPass ? "PASS" : "FAIL"}: ${averageRPM} RPM (needs ${MOTOR_RPM_TEST_MIN_RPM} RPM)`,
            style: isPass ? "motor-rpm-test-pass" : "motor-rpm-test-fail",
        });

        submitResult(isPass, averageRPM);
    };

    /**
     * Records the outcome against a tail in the Jaia database
     *
     * @param {boolean} isPass Whether the motor reached the required RPM
     * @param {number} averageRPM The RPM the motor settled at
     * @returns {void}
     */
    const submitResult = (isPass: boolean, averageRPM: number) => {
        // Results are filed against a tail, so one that can't name a tail isn't worth sending
        if (
            run.current.tailSerial === "" ||
            run.current.tailSerial.length > TAIL_SERIAL_MAX_LENGTH
        ) {
            setUpload({ text: "Not recorded in the database: no tail serial", style: "" });
            return;
        }

        // Every recorded result says who ran the test, so there is no recording one without it
        if (run.current.operatorName === "") {
            setUpload({ text: "Not recorded in the database: no operator name", style: "" });
            return;
        }

        const testResult: TestResult = {
            // Stays the same across retries, so the database can drop a result it already has
            external_id: `jcc-${jaiaAPI.clientId}-${Date.now()}`,
            test_type: "motor_rpm",
            asset_type: "tail",
            tail_serial: run.current.tailSerial,
            operator_name: run.current.operatorName,
            passed: isPass,
            summary: `${averageRPM} RPM (needs ${MOTOR_RPM_TEST_MIN_RPM})`,
            data: {
                average_rpm: averageRPM,
                threshold_rpm: MOTOR_RPM_TEST_MIN_RPM,
                samples: run.current.samples,
                bot_id: run.current.botID,
                bot_vin: run.current.botVIN,
            },
            // This browser's clock, not the bot's
            performed_at: new Date().toISOString(),
            source: "jcc",
        };

        setUpload({ text: "Recording result...", style: "" });

        jaiaAPI.submitTestResult(testResult).then((response) => {
            if (response.status === "ok") {
                setUpload({
                    text: `Recorded for tail ${testResult.tail_serial}`,
                    style: "motor-rpm-test-pass",
                });
                return;
            }

            if (response.status === "queued") {
                setUpload({
                    text: `Saved on this hub, waiting to reach the database (${response.queued} waiting)`,
                    style: "",
                });
                return;
            }

            setUpload({ text: response.message, style: "motor-rpm-test-fail" });
        });
    };

    return (
        <div className="motor-rpm-test-container">
            <div className="motor-rpm-test-note">
                Only enter a tail serial and your name if you want this result saved to the
                database.
            </div>
            <div className="motor-rpm-test-entry">
                <div>Tail Serial:</div>
                <input value={tailSerial} onChange={(evt) => setTailSerial(evt.target.value)} />
            </div>
            <div className="motor-rpm-test-entry">
                <div>Operator:</div>
                <input value={operatorName} onChange={(evt) => setOperatorName(evt.target.value)} />
            </div>
            <button
                className="engineering-button"
                disabled={isRunning}
                onClick={() => handleTestMotorRPMClick()}
            >
                Test Motor RPM
            </button>
            <div className={`motor-rpm-test-result ${result.style}`}>{result.text}</div>
            <div className="motor-rpm-test-note">
                {`Average of samples taken over ${MOTOR_RPM_TEST_MEASURE / 1000}s, ` +
                    `after a ${MOTOR_RPM_TEST_SPINUP / 1000}s spin-up`}
            </div>
            <div className={`motor-rpm-test-upload ${upload.style}`}>{upload.text}</div>
        </div>
    );
}
