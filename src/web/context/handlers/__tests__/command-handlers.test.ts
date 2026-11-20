import { handleSentCommand } from "../command-handlers";
import { handleSendRallyMission } from "../rally-point-handlers";
import Mission from "../../../data/mission_set/mission";
import { bots } from "../../../data/bots/bots";
import { missionSet } from "../../../data/mission_set/mission-set";
import { missionsManager } from "../../../data/missions_manager/missions-manager";
import { JaiaActions } from "../../jaia-actions";
import { JaiaContextType } from "../../../types/context-types";
import { UNASSIGNED_ID } from "../../../utils/constants";
import { Command_CommandType } from "@proto/jaiabot/messages/jaia_dccl";
import { MissionPlan_MovementType } from "@proto/jaiabot/messages/mission";

jest.mock("../handler-utils", () => ({
    syncOpenLayers: jest.fn(),
}));

const mutableState = {} as JaiaContextType;
const botID = 1;

function addMission() {
    const mission = new Mission();
    mission.addWaypoint({ lat: 41.66, lon: -71.27 });
    missionSet.addMission(mission);
    return mission;
}

function sendMission(mission: Mission) {
    missionsManager.assign(botID, mission.getMissionID());
    handleSentCommand(mutableState, {
        type: JaiaActions.SENT_COMMAND,
        command: {
            bot_id: botID,
            type: Command_CommandType.MISSION_PLAN,
            plan: { movement: MissionPlan_MovementType.TRANSIT },
        },
    });
}

beforeEach(() => {
    missionSet.deleteAllMissions();
    missionsManager.clear();
    bots.getBots().clear();
    bots.setBot({ bot_status: { bot_id: botID } });
});

describe("sending a mission", () => {
    test("marks it as the one the bot is running", () => {
        const mission = addMission();

        sendMission(mission);

        expect(mission.getGhostParameters().hasStarted).toBe(true);
        expect(mission.getGhostParameters().botID).toBe(botID);
    });

    test("clears the mark from the bot's previous mission", () => {
        const previous = addMission();
        const next = addMission();
        sendMission(previous);

        sendMission(next);

        expect(previous.getGhostParameters().hasStarted).toBe(false);
        expect(previous.getGhostParameters().botID).toBe(UNASSIGNED_ID);
        expect(next.getGhostParameters().botID).toBe(botID);
    });
});

describe("sending bots to a rally point", () => {
    test("clears the running mark from every mission", () => {
        const mission = addMission();
        sendMission(mission);

        handleSendRallyMission(mutableState);

        expect(mission.getGhostParameters().hasStarted).toBe(false);
    });
});
