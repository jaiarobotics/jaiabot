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

// Silence output while running tests
global.console.log = jest.fn()
global.console.error = jest.fn()
