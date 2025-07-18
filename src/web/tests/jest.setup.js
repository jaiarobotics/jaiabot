// Provide the Web API IndexedDB interface to Jest
import "fake-indexeddb/auto";

// Provide the Web API ResizeObserver interface to Jest
global.ResizeObserver = class ResizeObserver {
    constructor(callback) {
        this.callback = callback;
    }

    observe(target) {
        this.callback([{ target }]);
    }

    unobserve() {}

    disconnect() {}
};

// Silence non error output while running tests
global.console.log = jest.fn();
global.console.debug = jest.fn();

// setupTests.ts or jest.setup.js
// Enhanced gamepad API mocking
const createMockGamepad = () => ({
    axes: [0, 0, 0, 0],
    buttons: Array(16)
        .fill()
        .map(() => ({ pressed: false, touched: false, value: 0 })),
    connected: true,
    id: "Mock Xbox Controller",
    index: 0,
    mapping: "standard",
    timestamp: Date.now(),
    vibrationActuator: {
        playEffect: jest.fn().mockResolvedValue(undefined),
    },
});

Object.defineProperty(global.navigator, "getGamepads", {
    value: () => [createMockGamepad(), null, null, null], // Return mock gamepad in first slot
    writable: true,
});

// Mock Gamepad constructor
global.Gamepad = function () {
    return createMockGamepad();
};

// Mock GamepadEvent constructor
global.GamepadEvent = function (type, options = {}) {
    this.type = type;
    this.gamepad = options.gamepad || null;
};

// Mock requestAnimationFrame and cancelAnimationFrame if not already present
if (!global.requestAnimationFrame) {
    global.requestAnimationFrame = (callback) => setTimeout(callback, 16);
}

if (!global.cancelAnimationFrame) {
    global.cancelAnimationFrame = (id) => clearTimeout(id);
}
