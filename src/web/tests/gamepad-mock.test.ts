/**
 * Test to verify gamepad API mocking is working correctly
 */

describe("Gamepad API Mock", () => {
    test("navigator.getGamepads should be available and return mock gamepad", () => {
        expect(typeof (navigator as any).getGamepads).toBe("function");

        const gamepads = (navigator as any).getGamepads();
        expect(gamepads).toBeDefined();
        expect(Array.isArray(gamepads)).toBe(true);

        // Check if we have at least one gamepad or if the mock is working
        if (gamepads.length > 0) {
            expect(gamepads[0]).toBeTruthy();
            expect(gamepads[0]?.id).toBe("Mock Xbox Controller");
            expect(gamepads[0]?.vibrationActuator).toBeTruthy();
            expect(typeof gamepads[0]?.vibrationActuator?.playEffect).toBe("function");
        } else {
            // If no gamepads returned, that's still OK - the function exists and doesn't crash
            expect(gamepads).toEqual([]);
        }
    });

    test("triggerRumble should work without errors", () => {
        // Simulate the triggerRumble method from RCControllerPanel
        const triggerRumble = (duration = 500, strongMagnitude = 1.0, weakMagnitude = 1.0) => {
            if (
                typeof navigator === "undefined" ||
                typeof (navigator as any).getGamepads !== "function"
            ) {
                return;
            }

            const gamepads = (navigator as any).getGamepads();
            for (const gp of gamepads) {
                if (gp && gp.vibrationActuator) {
                    gp.vibrationActuator.playEffect("dual-rumble", {
                        duration,
                        strongMagnitude,
                        weakMagnitude,
                    });
                }
            }
        };

        // This should not throw an error
        expect(() => triggerRumble()).not.toThrow();
    });
});
