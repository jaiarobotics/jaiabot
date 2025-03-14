// Mock JaiaAPI, replace the hit method on the jaiaAPI instance
// Import the real module to access the original jaiaAPI instance
const originalModule = jest.requireActual("../../utils/jaia-api");

originalModule.jaiaAPI.hit = jest
    .fn()
    .mockResolvedValue({ code: 200, msg: "Mocked Success", bots: [], hubs: [] });

module.exports = {
    ...originalModule, // Spread the real module
    jaiaAPI: originalModule.jaiaAPI, // Keep the original jaiaAPI instance with the mocked hit
};
