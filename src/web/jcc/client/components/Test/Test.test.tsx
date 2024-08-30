import { render, screen, fireEvent } from "@testing-library/react";

import { Test } from "./Test";

describe("MUI toggle triggers expected UI changes", () => {
    test("Setting toggle to checked removes Max Depth from screen", () => {
        render(<Test />);
        const toggle = screen.getByRole("checkbox");
        expect(screen.getByText("Max Depth")).toBeVisible();
        fireEvent.click(toggle);
        expect(screen.queryByText("Max Depth")).toBeNull();
    });
});
