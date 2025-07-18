/**
 * Test file for gamepad API mocking setup
 * Ensures navigator.getGamepads and related APIs are properly mocked for Jest environment
 */

describe("Gamepad API Mocking", () => {
    test("navigator.getGamepads should be available", () => {
        expect((navigator as any).getGamepads).toBeDefined();
        expect(typeof (navigator as any).getGamepads).toBe("function");
    });

    test("navigator.getGamepads should return array with mock gamepad", () => {
        const gamepads = (navigator as any).getGamepads();
        expect(Array.isArray(gamepads)).toBe(true);
        expect(gamepads.length).toBe(4); // Standard gamepad array length
        expect(gamepads[0]).toBeTruthy(); // First slot has mock gamepad
        expect(gamepads[0].id).toBe("Mock Xbox Controller");
        expect(gamepads[1]).toBeNull(); // Other slots are null
        expect(gamepads[2]).toBeNull();
        expect(gamepads[3]).toBeNull();
    });

    test("Gamepad constructor should be available globally", () => {
        expect((window as any).Gamepad).toBeDefined();
        expect(typeof (window as any).Gamepad).toBe("function");
    });

    test("GamepadEvent constructor should be available globally", () => {
        expect((window as any).GamepadEvent).toBeDefined();
        expect(typeof (window as any).GamepadEvent).toBe("function");
    });

    test("requestAnimationFrame should be available", () => {
        expect(window.requestAnimationFrame).toBeDefined();
        expect(typeof window.requestAnimationFrame).toBe("function");
    });

    test("cancelAnimationFrame should be available", () => {
        expect(window.cancelAnimationFrame).toBeDefined();
        expect(typeof window.cancelAnimationFrame).toBe("function");
    });

    test("mock gamepad should have vibrationActuator", () => {
        const mockGamepad = new (window as any).Gamepad();
        expect(mockGamepad.vibrationActuator).toBeDefined();
        expect(mockGamepad.vibrationActuator.playEffect).toBeDefined();
        expect(typeof mockGamepad.vibrationActuator.playEffect).toBe("function");
    });

    test("mock gamepad vibrationActuator.playEffect should work", async () => {
        const mockGamepad = new (window as any).Gamepad();

        // Should not throw an error
        expect(() => {
            mockGamepad.vibrationActuator.playEffect("dual-rumble", {
                duration: 200,
                strongMagnitude: 0.5,
                weakMagnitude: 0.5,
            });
        }).not.toThrow();
    });
});
