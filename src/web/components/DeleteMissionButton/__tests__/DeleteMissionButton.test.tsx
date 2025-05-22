import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import DeleteMissionButton from "../DeleteMissionButton";
import { DisabledCodes, messages } from "../delete-mission-messages";

import { bots } from "../../../data/bots/bots";
import { PortalBotStatus } from "../../../shared/PortalStatus";
import { MissionState } from "../../../types/protobuf-types";

const botStatusMock1: PortalBotStatus = {
    bot_id: 1,
    mission_state: MissionState.IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT,
};

const botStatusMock2: PortalBotStatus = {
    bot_id: 2,
    mission_state: MissionState.PRE_DEPLOYMENT__IDLE,
};

bots.setBot(botStatusMock1);
bots.setBot(botStatusMock2);
