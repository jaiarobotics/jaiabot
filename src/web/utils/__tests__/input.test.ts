import { MAX_LAT, MAX_LON, MIN_LAT, MIN_LON } from "../constants";
import { clampInput, clampInteger, validateCoordinate } from "../input";

test("Enforce lower bounds on coordinates", () => {
    const validatedCoordinates = validateCoordinate("-100", "-200");
    expect(validatedCoordinates[0]).toBe(MIN_LAT.toString());
    expect(validatedCoordinates[1]).toBe(MIN_LON.toString());
});

test("Enforce upper bounds on coordinates", () => {
    const validatedCoordinates = validateCoordinate("100", "200");
    expect(validatedCoordinates[0]).toBe(MAX_LAT.toString());
    expect(validatedCoordinates[1]).toBe(MAX_LON.toString());
});

test("Make no changes to valid coordinates", () => {
    const validatedCoordinates = validateCoordinate("50", "100");
    expect(validatedCoordinates[0]).toBe("50");
    expect(validatedCoordinates[1]).toBe("100");
});

test("Make no changes to non-numerical input", () => {
    const validatedCoordinates = validateCoordinate("-", ".");
    expect(validatedCoordinates[0]).toBe("-");
    expect(validatedCoordinates[1]).toBe(".");
});

test("Clamp to a lower bound of -1", () => {
    expect(clampInput(-5, -1, 10)).toBe(-1);
});

test("Clamp numeric strings to numbers", () => {
    expect(clampInput("12" as unknown as number, 0, 10)).toBe(10);
    expect(clampInput("5" as unknown as number, 0, 10)).toBe(5);
});

test("Clamp a value that is not a number to the lower bound", () => {
    expect(clampInput(NaN, 1, 3)).toBe(1);
});

test("Round clamped integers", () => {
    expect(clampInteger(1.5, 1, 3)).toBe(2);
    expect(clampInteger(2.4, 1, 3)).toBe(2);
    expect(clampInteger(0.5, 1, 3)).toBe(1);
    expect(clampInteger(3.6, 1, 3)).toBe(3);
});
