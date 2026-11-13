import { PortalBotStatus } from "@proto/jaiabot/messages/rest_api";
import { bots } from "../../../data/bots/bots";

const mockBotStatus1: PortalBotStatus = {
    bot_status: {
        bot_id: 1,
    },
};

const mockBotStatus2: PortalBotStatus = {
    bot_status: {
        bot_id: 2,
    },
};

const mockBotStatus5: PortalBotStatus = {
    bot_status: {
        bot_id: 5,
    },
};

test("Verify bots are sorted when adding", () => {
    // Add Bots to data model in non-numerical order
    bots.setBot(mockBotStatus5);
    bots.setBot(mockBotStatus1);
    bots.setBot(mockBotStatus2);
    // Get resulting bots data
    const addedBots = Array.from(bots.getBots().values());
    expect(addedBots[0].getBotID()).toEqual(1);
    expect(addedBots[1].getBotID()).toEqual(2);
    expect(addedBots[2].getBotID()).toEqual(5);
});

test("Each status update replaces the bot's active mission plan", () => {
    const plan = { goal: [{ location: { lat: 41.66, lon: -71.27 } }] };

    bots.setBot({ bot_status: { bot_id: 7 }, active_mission_plan: plan });
    expect(bots.getBot(7).getActiveMissionPlan()).toEqual(plan);

    bots.setBot({ bot_status: { bot_id: 7 } });
    expect(bots.getBot(7).getActiveMissionPlan()).toBeUndefined();
});

test("A repeat index of 0 is the bot's first pass, not a missing one", () => {
    bots.setBot({ bot_status: { bot_id: 8, repeat_index: 0 } });
    expect(bots.getBot(8).getMissionStatus().repeatIndex).toBe(0);

    bots.setBot({ bot_status: { bot_id: 8 } });
    expect(bots.getBot(8).getMissionStatus().repeatIndex).toBeUndefined();
});
