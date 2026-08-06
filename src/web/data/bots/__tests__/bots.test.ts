import { PortalBotStatus } from "../../../shared/PortalStatus";
import { bots } from "../../../data/bots/bots";

const mockBotStatus1: PortalBotStatus = {
    bot_id: 1,
};

const mockBotStatus2: PortalBotStatus = {
    bot_id: 2,
};

const mockBotStatus5: PortalBotStatus = {
    bot_id: 5,
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

test("Verify a zero constant heading time remaining is preserved", () => {
    bots.setBot({ bot_id: 1, constant_heading_time_remaining: 0 });
    expect(bots.getBot(1).getMissionStatus().constantHeadingTimeRemaining).toEqual(0);
});
