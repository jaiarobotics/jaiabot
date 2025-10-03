import { JaiaActions, actionConfigs } from "../jaia-actions";

describe("actionConfigs map completeness", () => {
    test("should have a config for every JaiaAction", () => {
        const missingActions: string[] = [];

        Object.values(JaiaActions).forEach((action) => {
            if (!actionConfigs.has(action)) {
                missingActions.push(action);
            }
        });

        expect(missingActions).toEqual([]);
    });
});

test("Check initial state for completness", () => {});
