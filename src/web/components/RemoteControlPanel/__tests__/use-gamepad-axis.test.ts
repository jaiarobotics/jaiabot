import { renderHook } from "@testing-library/react";

import { GamepadAxisName, useGamepadAxis } from "../use-gamepad-axis";

type AxisReport = [GamepadAxisName, number];

/**
 * Drives the hook's polling loop by hand: requestAnimationFrame is stubbed to record the
 * callback rather than schedule it, so each test steps the loop exactly as many times as it
 * needs to.
 */
function pollWith(axisFrames: number[][]) {
    const reported: AxisReport[] = [];
    let pending: FrameRequestCallback | null = null;
    let frame = 0;

    jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
        pending = callback;
        return ++frame;
    });
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {
        pending = null;
    });

    // jsdom does not implement the Gamepad API, so define it rather than spy on it
    let current: number[] = axisFrames[0];
    Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        writable: true,
        value: () => [{ axes: current }] as unknown as (Gamepad | null)[],
    });

    const view = renderHook(() =>
        useGamepadAxis((axisName, value) => reported.push([axisName, value])),
    );

    for (const axes of axisFrames) {
        current = axes;
        const callback = pending;
        pending = null;
        callback?.(0);
    }

    return { reported, view };
}

afterEach(() => {
    jest.restoreAllMocks();
});

describe("useGamepadAxis", () => {
    test("reports LeftStickY inverted, because the browser reports it upside down", () => {
        const { reported } = pollWith([[0, -1, 0, 0]]);

        expect(reported).toContainEqual(["LeftStickY", 1]);
    });

    test("reports RightStickX as-is", () => {
        const { reported } = pollWith([[0, 0, 0.75, 0]]);

        expect(reported).toContainEqual(["RightStickX", 0.75]);
    });

    test("clamps values inside the dead zone to zero", () => {
        const { reported } = pollWith([[0.05, 0, 0.05, 0]]);

        expect(reported.filter(([, value]) => value !== 0)).toEqual([]);
    });

    test("reports a value just outside the dead zone", () => {
        const { reported } = pollWith([[0, 0, 0.09, 0]]);

        expect(reported).toContainEqual(["RightStickX", 0.09]);
    });

    test("reports an axis only when its value changes", () => {
        const { reported } = pollWith([
            [0, 0, 0.5, 0],
            [0, 0, 0.5, 0],
            [0, 0, 0.25, 0],
        ]);

        expect(reported.filter(([axisName]) => axisName === "RightStickX")).toEqual([
            ["RightStickX", 0.5],
            ["RightStickX", 0.25],
        ]);
    });

    test("ignores axes beyond the known layout", () => {
        const { reported } = pollWith([[0, 0, 0, 0, 0.9, 0.9]]);

        expect(reported).toEqual([]);
    });

    test("stops polling when unmounted", () => {
        const { view } = pollWith([[0, 0, 0, 0]]);

        view.unmount();

        expect(window.cancelAnimationFrame).toHaveBeenCalled();
    });
});
