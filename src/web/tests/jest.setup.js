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
