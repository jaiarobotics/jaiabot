import { render, screen } from "@testing-library/react";

import HealthRow from "../HealthRow";
import { JaiaContextProvider } from "../../../../context/JaiaContext";

import { bots } from "../../../../data/bots/bots";
import { jaiaGlobal } from "../../../../data/jaia_global/jaia-global";

import { HealthState } from "../../../../shared/proto/goby/middleware/protobuf/coroner";
import { Error, Warning } from "../../../../shared/proto/jaiabot/messages/health";
import { NodeTypes } from "../../../../types/jaia-system-types";
import { PortalBotStatus } from "../../../../shared/PortalStatus";

const botStatusMock1: PortalBotStatus = {
    bot_id: 1,
    health_state: HealthState.HEALTH__OK,
};

const botStatusMock2: PortalBotStatus = {
    bot_id: 2,
    health_state: HealthState.HEALTH__DEGRADED,
    warning: [Warning.WARNING__MISSION__DATA__GPS_FIX_DEGRADED],
};

const botStatusMock3: PortalBotStatus = {
    bot_id: 3,
    health_state: HealthState.HEALTH__FAILED,
    error: [Error.ERROR__VEHICLE__CRITICALLY_LOW_BATTERY, Error.ERROR__FAILED__JAIABOT_HEALTH],
    warning: [Warning.WARNING__MISSION__DATA_OFFLOAD_FAILED],
};

bots.setBot(botStatusMock1);
bots.setBot(botStatusMock2);
bots.setBot(botStatusMock3);

test("Render HealthRow for Bot with HEALTH__OK", () => {
    jaiaGlobal.setSelectedNode({ type: NodeTypes.BOT, id: 1 });

    render(
        <JaiaContextProvider>
            <HealthRow />
        </JaiaContextProvider>,
    );

    expect(screen.getByText("HEALTH__OK")).toBeInTheDocument();
});

test("Render HealthRow for Bot with HEALTH__DEGRADED", () => {
    jaiaGlobal.setSelectedNode({ type: NodeTypes.BOT, id: 2 });

    render(
        <JaiaContextProvider>
            <HealthRow />
        </JaiaContextProvider>,
    );

    expect(screen.getByText("HEALTH__DEGRADED")).toBeInTheDocument();
    expect(screen.getByText("WARNING__MISSION__DATA__GPS_FIX_DEGRADED")).toBeInTheDocument();
});

test("Render HealthRow for Bot with HEALTH__FAILED", () => {
    jaiaGlobal.setSelectedNode({ type: NodeTypes.BOT, id: 3 });

    render(
        <JaiaContextProvider>
            <HealthRow />
        </JaiaContextProvider>,
    );

    expect(screen.getByText("HEALTH__FAILED")).toBeInTheDocument();
    expect(screen.getByText("ERROR__VEHICLE__CRITICALLY_LOW_BATTERY")).toBeInTheDocument();
    expect(screen.getByText("ERROR__FAILED__JAIABOT_HEALTH")).toBeInTheDocument();
    expect(screen.getByText("WARNING__MISSION__DATA_OFFLOAD_FAILED")).toBeInTheDocument();
});
