import { validateCoordinate } from "../input";

test("Enforce lower bounds on coordinates", () => {
    const validatedCoordinates = validateCoordinate("-100", "-200");
    expect(validatedCoordinates[0]).toBe("-90");
    expect(validatedCoordinates[1]).toBe("-180");
});

test("Enforce upper bounds on coordinates", () => {
    const validatedCoordinates = validateCoordinate("100", "200");
    expect(validatedCoordinates[0]).toBe("90");
    expect(validatedCoordinates[1]).toBe("180");
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
