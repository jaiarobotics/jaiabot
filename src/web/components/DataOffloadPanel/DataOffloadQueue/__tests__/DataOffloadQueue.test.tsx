import { render, screen } from "@testing-library/react";

import DataOffloadQueue from "../DataOffloadQueue";
import { JaiaContext } from "../../../../context/JaiaContext";
import { Hubs } from "../../../../data/hubs/hubs";
import { JaiaContextType } from "../../../../types/context-types";

function renderQueue(hubs: Hubs) {
    render(
        <JaiaContext.Provider value={{ hubs } as JaiaContextType}>
            <DataOffloadQueue />
        </JaiaContext.Provider>,
    );
}

describe("DataOffloadQueue", () => {
    test("shows the offload of a Hub that is not the lowest numbered", () => {
        const hubs = new Hubs();
        // A Hub heard over hub-to-hub reports no offload
        hubs.setHub({ hub_status: { hub_id: 2, fleet_id: 7, time: "1" }, status_age: 0 });
        hubs.setHub({
            hub_status: {
                hub_id: 30,
                fleet_id: 7,
                time: "1",
                bot_offload: { bot_id: 3, data_offload_percentage: 40, bots_pending: [4] },
            },
            status_age: 0,
        });

        renderQueue(hubs);

        expect(screen.getByText("Bot 3")).toBeInTheDocument();
        expect(screen.getByText("Bot 4")).toBeInTheDocument();
    });

    test("shows nothing when no Hub is offloading", () => {
        const hubs = new Hubs();
        hubs.setHub({ hub_status: { hub_id: 1, fleet_id: 7, time: "1" }, status_age: 0 });

        renderQueue(hubs);

        expect(screen.queryByText(/^Bot /)).not.toBeInTheDocument();
    });
});
