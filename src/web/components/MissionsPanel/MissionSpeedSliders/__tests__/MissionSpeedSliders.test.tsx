import { fireEvent, render, screen } from "@testing-library/react";

import MissionSpeedSliders from "../MissionSpeedSliders";
import {
    JaiaContext,
    JaiaContextProvider,
    JaiaDispatchContext,
} from "../../../../context/JaiaContext";
import { handleChangeMissionSpeeds } from "../../../../context/handlers/mission-handlers";
import { JaiaAction, JaiaContextType } from "../../../../types/context-types";

import Mission from "../../../../data/mission_set/mission";
import { missionSet } from "../../../../data/mission_set/mission-set";

// MUI ThemeProvider contains undefined values that add console output in the test environment
beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(jest.fn());
    missionSet.deleteAllMissions();
});

afterEach(() => {
    missionSet.deleteAllMissions();
});

test("Sliders are enabled when no missions exist", () => {
    render(
        <JaiaContextProvider>
            <MissionSpeedSliders />
        </JaiaContextProvider>,
    );

    expect(screen.getByRole("slider", { name: "Transit Speed" })).not.toBeDisabled();
    expect(screen.getByRole("slider", { name: "Station Keep Speed" })).not.toBeDisabled();
});

test("Speed set with no missions is applied when a mission is added", () => {
    render(
        <JaiaContextProvider>
            <MissionSpeedSliders />
        </JaiaContextProvider>,
    );

    fireEvent.change(screen.getByRole("slider", { name: "Transit Speed" }), {
        target: { value: 3 },
    });
    fireEvent.change(screen.getByRole("slider", { name: "Station Keep Speed" }), {
        target: { value: 1 },
    });

    missionSet.addMission(new Mission());

    expect(missionSet.getMissionSpeeds().transit).toBe(3);
    expect(missionSet.getMissionSpeeds().stationkeep_outer).toBe(1);
});

test("Move mission speed sliders in opposite directions", () => {
    missionSet.addMission(new Mission());

    render(
        <JaiaContextProvider>
            <MissionSpeedSliders />
        </JaiaContextProvider>,
    );

    const transitSlider = screen.getByRole("slider", { name: "Transit Speed" });
    const stationKeepSlider = screen.getByRole("slider", { name: "Station Keep Speed" });

    fireEvent.change(transitSlider, { target: { value: 3 } });
    fireEvent.change(stationKeepSlider, { target: { value: 1 } });

    expect(missionSet.getMissionSpeeds().transit).toBe(3);
    expect(missionSet.getMissionSpeeds().stationkeep_outer).toBe(1);

    fireEvent.change(transitSlider, { target: { value: 1 } });
    fireEvent.change(stationKeepSlider, { target: { value: 3 } });

    expect(missionSet.getMissionSpeeds().transit).toBe(1);
    expect(missionSet.getMissionSpeeds().stationkeep_outer).toBe(3);
});

describe("Whole speeds", () => {
    function renderSliders() {
        const jaiaDispatch = (action: JaiaAction) =>
            handleChangeMissionSpeeds({} as JaiaContextType, action);

        render(
            <JaiaContext.Provider value={{ missionSet } as JaiaContextType}>
                <JaiaDispatchContext.Provider value={jaiaDispatch}>
                    <MissionSpeedSliders />
                </JaiaDispatchContext.Provider>
            </JaiaContext.Provider>,
        );

        return [
            screen.getByRole("slider", { name: "Transit Speed" }),
            screen.getByRole("slider", { name: "Station Keep Speed" }),
        ];
    }

    test("sliders step by 1 m/s from 1 to 3 m/s", () => {
        for (const slider of renderSliders()) {
            expect(slider).toHaveAttribute("step", "1");
            expect(slider).toHaveAttribute("min", "1");
            expect(slider).toHaveAttribute("max", "3");
        }
    });

    test.each([
        [3, 0.5, 1],
        [3, 1.5, 2],
        [1, 2.5, 3],
    ])("from %p m/s, a slider value of %p m/s is stored as %p m/s", (start, value, expected) => {
        missionSet.setMissionSpeeds({ transit: start, stationkeep_outer: start });
        const [transitSlider, stationKeepSlider] = renderSliders();

        fireEvent.change(transitSlider, { target: { value } });
        fireEvent.change(stationKeepSlider, { target: { value } });

        expect(missionSet.getMissionSpeeds()).toEqual({
            transit: expected,
            stationkeep_outer: expected,
        });
    });
});
