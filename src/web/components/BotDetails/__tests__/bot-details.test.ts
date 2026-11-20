import { formatMotorTemperatures } from "../bot-details";

describe("formatMotorTemperatures", () => {
    test("shows N/A before the first check", () => {
        expect(formatMotorTemperatures([])).toBe("N/A");
        expect(formatMotorTemperatures(undefined)).toBe("N/A");
    });

    test("lists the checks oldest first, rounded to whole degrees", () => {
        expect(formatMotorTemperatures([61.6, 70.2, 78])).toBe("62, 70, 78 °C");
    });
});
