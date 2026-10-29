import { act, fireEvent, render, screen } from "@testing-library/react";
import { IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";

import RemoteControlPanel from "../RemoteControlPanel";
import { AnalogStickProps, AnalogStickTypes } from "../AnalogStick/AnalogStick";
import { sendBotCommand, sendEngineeringCommand } from "../../../utils/commands";
import { PIDControl } from "@proto/jaiabot/messages/engineering";

// MotorBounds.throttle_zero_net_buoyancy default: more reverse than this sinks the bot
const THROTTLE_ZERO_NET_BUOYANCY = -35;

const COMMAND_INTERVAL_MS = 500;

jest.mock("../../../utils/commands", () => ({
    sendBotCommand: jest.fn(),
    sendEngineeringCommand: jest.fn(),
}));

// jsdom has no Gamepad API
jest.mock("../use-gamepad-axis", () => ({
    useGamepadAxis: (): void => undefined,
}));

const mockSticks = new Map<AnalogStickTypes, AnalogStickProps>();
jest.mock("../AnalogStick/AnalogStick", () => ({
    ...jest.requireActual("../AnalogStick/AnalogStick"),
    AnalogStick: (props: AnalogStickProps): null => {
        mockSticks.set(props.analogStickType, props);
        return null;
    },
}));

beforeEach(() => {
    jest.useFakeTimers();
    mockSticks.clear();
    (sendEngineeringCommand as jest.Mock).mockClear();
    render(<RemoteControlPanel botID={1} />);
});

afterEach(() => {
    jest.useRealTimers();
});

function moveStick(stickType: AnalogStickTypes, position: number) {
    const event = { x: position, y: position } as IJoystickUpdateEvent;
    act(() => mockSticks.get(stickType).handleAnalogStickMove(event, stickType));
}

function releaseStick(stickType: AnalogStickTypes) {
    act(() => mockSticks.get(stickType).onAnalogStickStop());
}

function waitForCommands(milliseconds: number) {
    act(() => jest.advanceTimersByTime(milliseconds));
}

function sentCommands(): PIDControl[] {
    return (sendEngineeringCommand as jest.Mock).mock.calls.map((call) => call[0].pid_control);
}

function lastCommand() {
    return sentCommands().at(-1);
}

test("Reverse throttle is not strong enough to sink the bot", () => {
    moveStick(AnalogStickTypes.LEFT, -0.6);
    waitForCommands(COMMAND_INTERVAL_MS);

    expect(lastCommand().throttle).toBeLessThan(0);
    expect(lastCommand().throttle).toBeGreaterThan(THROTTLE_ZERO_NET_BUOYANCY);
});

test.each([
    { released: "rudder", stick: AnalogStickTypes.RIGHT, expected: { throttle: 40, rudder: 0 } },
    { released: "throttle", stick: AnalogStickTypes.LEFT, expected: { throttle: 0, rudder: 70 } },
])("Releasing the $released stick leaves the other stick's command", ({ stick, expected }) => {
    moveStick(AnalogStickTypes.LEFT, 0.6);
    moveStick(AnalogStickTypes.RIGHT, 0.6);
    waitForCommands(COMMAND_INTERVAL_MS);
    expect(lastCommand()).toMatchObject({ throttle: 40, rudder: 70 });

    releaseStick(stick);
    waitForCommands(COMMAND_INTERVAL_MS);

    expect(lastCommand()).toMatchObject(expected);
});

test("Commands keep going out while the stick moves between throttle steps", () => {
    const slowerStep = 0.49;
    const fasterStep = 0.51;
    moveStick(AnalogStickTypes.LEFT, slowerStep);
    waitForCommands(COMMAND_INTERVAL_MS);
    const slowerThrottle = lastCommand().throttle;
    moveStick(AnalogStickTypes.LEFT, fasterStep);
    waitForCommands(COMMAND_INTERVAL_MS);
    expect(lastCommand().throttle).not.toBe(slowerThrottle);
    (sendEngineeringCommand as jest.Mock).mockClear();

    const stepChangeMs = 400;
    for (let elapsed = 0; elapsed < 10_000; elapsed += stepChangeMs) {
        moveStick(AnalogStickTypes.LEFT, elapsed % (2 * stepChangeMs) ? fasterStep : slowerStep);
        waitForCommands(stepChangeMs);
    }

    expect(sentCommands()).toHaveLength(10_000 / COMMAND_INTERVAL_MS);
});

test("Commands tell the bot to stop within 2 s if they stop arriving", () => {
    moveStick(AnalogStickTypes.LEFT, 0.6);
    waitForCommands(COMMAND_INTERVAL_MS);

    expect(lastCommand().timeout).toBe(2);
});

test("RC dive parameters are held to the proto's bounds", async () => {
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Dive" }));
    const inputs = new Map(
        ["max_depth", "depth_interval", "hold_time", "drift_time"].map((name) => [
            name,
            document.querySelector(`input[name="${name}"]`) as HTMLInputElement,
        ]),
    );

    fireEvent.change(inputs.get("max_depth"), { target: { value: "60" } });
    fireEvent.change(inputs.get("depth_interval"), { target: { value: "0" } });
    fireEvent.change(inputs.get("hold_time"), { target: { value: "100" } });
    fireEvent.change(inputs.get("drift_time"), { target: { value: "12.6" } });

    expect(Array.from(inputs.values()).map((input) => input.value)).toEqual([
        "50",
        "0.1",
        "80",
        "13",
    ]);

    (sendBotCommand as jest.Mock).mockResolvedValue({});
    await act(async () => fireEvent.click(screen.getByTitle("Send Dive Command")));

    expect((sendBotCommand as jest.Mock).mock.calls[0][0].rc_task).toMatchObject({
        dive: { max_depth: 50, depth_interval: 0.1, hold_time: 80 },
        surface_drift: { drift_time: 13 },
    });
});
