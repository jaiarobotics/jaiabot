import { fireEvent, render, screen } from "@testing-library/react";

import MissionSpeedSliders from "../MissionSpeedSliders";
import { JaiaContextProvider } from "../../../../context/JaiaContext";

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

test("Sliders are disabled when no missions exist", () => {
    render(
        <JaiaContextProvider>
            <MissionSpeedSliders />
        </JaiaContextProvider>,
    );

    expect(screen.getByRole("slider", { name: "Transit Speed" })).toBeDisabled();
    expect(screen.getByRole("slider", { name: "Station Keep Speed" })).toBeDisabled();
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
