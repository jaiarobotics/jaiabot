import { render, screen, fireEvent, prettyDOM, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import JaiaToggle from "../JaiaToggle";

describe("JaiaToggle", () => {
    test("JaiaToggle switching on/off", async () => {
        let isChecked = false;

        const props = {
            checked: () => isChecked,
            onClick: () => {
                isChecked = !isChecked;
            },
            disabled: () => false,
            label: "Test Label",
            title: "Test Title",
        };

        render(<JaiaToggle {...props} />);
        const toggle: HTMLInputElement = screen.getByRole("checkbox");

        await userEvent.click(toggle);
        expect(isChecked).toBe(true);
        await userEvent.click(toggle);
        expect(isChecked).toBe(false);
    });

    test("JaiaToggle disables", () => {
        let isChecked = false;

        const props = {
            checked: () => false,
            onClick: () => {},
            disabled: () => true,
            label: "Test Label",
            title: "Test Title",
        };

        render(<JaiaToggle {...props} />);
        const toggle: HTMLInputElement = screen.getByRole("checkbox");

        expect(toggle.disabled).toBe(true);
    });
});
