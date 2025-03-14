// Mock the CustomLayers, replace  createCustomLayerGroup
// Create a mock class for CustomLayerGroupFactory
const MockCustomLayerGroupFactory = jest.fn().mockImplementation(() => ({
    // Mock all methods or properties used by the module under test
    createCustomLayerGroup: jest.fn().mockResolvedValue(undefined), // Example method
    on: jest.fn(), // Mock event subscription
    off: jest.fn(), // Mock event unsubscription
}));

module.exports = {
    CustomLayerGroupFactory: MockCustomLayerGroupFactory,
};
