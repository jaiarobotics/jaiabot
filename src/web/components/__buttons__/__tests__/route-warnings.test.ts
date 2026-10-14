import { RouteWarning } from "../../../utils/routing/routing-status";
import { describeRouteWarning, describeRouteWarningsForBots } from "../route-warnings";

describe("describeRouteWarning", () => {
    test("names the mission and the Bot", () => {
        expect(describeRouteWarning(RouteWarning.ROUTE_CROSSES_ZONE, 3, 7)).toBe(
            "Mission 7's route crosses an exclusion zone.",
        );
        expect(describeRouteWarning(RouteWarning.APPROACH_CROSSES_ZONE, 3, 7)).toBe(
            "Bot 3's path to its first waypoint crosses an exclusion zone. Move the first waypoint, or drive the bot clear first.",
        );
        expect(describeRouteWarning(RouteWarning.START_INSIDE_ZONE, 3, 7)).toBe(
            "Bot 3 is inside an exclusion zone or its safety margin.",
        );
    });
});

describe("describeRouteWarningsForBots", () => {
    test("lists the Bots under each warning, and leaves out warnings no Bot has", () => {
        const botsByWarning = new Map([
            [RouteWarning.ROUTE_CROSSES_ZONE, [2, 5]],
            [RouteWarning.APPROACH_CROSSES_ZONE, []],
            [RouteWarning.START_INSIDE_ZONE, [4]],
        ]);

        expect(describeRouteWarningsForBots(botsByWarning)).toEqual([
            "Mission routes cross an exclusion zone for Bots: 2, 5.",
            "Bot: 4 is inside an exclusion zone or its safety margin.",
        ]);
    });

    test("words each warning for one Bot and for several", () => {
        const approach = (botIDs: number[]) =>
            describeRouteWarningsForBots(
                new Map([[RouteWarning.APPROACH_CROSSES_ZONE, botIDs]]),
            )[0];

        expect(approach([3])).toBe(
            "The path to the first waypoint crosses an exclusion zone for Bot: 3. Move the first waypoint, or drive the bot clear first.",
        );
        expect(approach([3, 6])).toBe(
            "The paths to the first waypoint cross an exclusion zone for Bots: 3, 6. Move the first waypoint, or drive the bots clear first.",
        );
    });
});
