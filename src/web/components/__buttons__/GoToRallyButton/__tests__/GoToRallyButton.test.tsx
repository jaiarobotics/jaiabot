import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import GoToRallyButton from "../GoToRallyButton";
import { JaiaDispatchContext } from "../../../../context/JaiaContext";
import RallyPoint from "../../../../data/rally_points/rally-point";
import { bots } from "../../../../data/bots/bots";
import { sendBotCommand } from "../../../../utils/commands";
import { MissionState } from "@proto/jaiabot/messages/mission";

jest.mock("../../../../utils/commands", () => ({
    ...jest.requireActual("../../../../utils/commands"),
    isControllingClient: jest.fn(() => true),
    sendBotCommand: jest.fn(() => Promise.resolve({})),
}));

bots.setBot({
    bot_status: {
        bot_id: 1,
        mission_state: MissionState.PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN,
        battery_percent: 50,
    },
    status_age: 1_000_000,
});

test("Rally plan speeds are whole speeds within the proto's bounds", async () => {
    const rallyPoint = new RallyPoint();
    rallyPoint.setLocation({ lat: 41.5, lon: -71.3 });

    render(
        <JaiaDispatchContext.Provider value={jest.fn()}>
            <GoToRallyButton
                bots={bots.getBots()}
                rallyPoint={rallyPoint}
                missionSpeeds={{ transit: 1.5, stationkeep_outer: 0.5 }}
            />
        </JaiaDispatchContext.Provider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "go-to-rally-point" }));
    await userEvent.click(screen.getByText("Rally Bot"));

    expect((sendBotCommand as jest.Mock).mock.calls[0][0].plan.speeds).toEqual({
        transit: 2,
        stationkeep_outer: 1,
    });
});
