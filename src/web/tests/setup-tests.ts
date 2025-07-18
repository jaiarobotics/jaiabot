import "@testing-library/jest-dom";

// TypeScript declarations for gamepad API mocks
declare global {
    interface Navigator {
        getGamepads(): (Gamepad | null)[];
    }

    interface Window {
        Gamepad: any;
        GamepadEvent: any;
    }
}

// Additional gamepad API safety mocks for TypeScript environment
if (typeof (navigator as any).getGamepads === "undefined") {
    (navigator as any).getGamepads = (): (Gamepad | null)[] => [null, null, null, null];
}

if (typeof (window as any).Gamepad === "undefined") {
    (window as any).Gamepad = function () {
        return {
            axes: [] as any[],
            buttons: [] as any[],
            connected: false,
            id: "Mock Gamepad",
            index: 0,
            mapping: "standard",
            timestamp: 0,
            vibrationActuator: {
                playEffect: jest.fn().mockResolvedValue(undefined),
            },
        };
    };
}

if (typeof (window as any).GamepadEvent === "undefined") {
    (window as any).GamepadEvent = function (type: string, options: any = {}) {
        this.type = type;
        this.gamepad = options.gamepad || null;
    };
}
