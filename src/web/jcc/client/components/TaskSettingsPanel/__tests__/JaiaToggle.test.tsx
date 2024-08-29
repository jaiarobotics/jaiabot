import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JaiaTogglePage from "../JaiaTogglePage";

test("flipping switch changes boolean", async () => {
    render(<JaiaTogglePage />);
    const switchComponent = screen.getByRole("checkbox");
    expect(switchComponent).not.toBeChecked();
    userEvent.click(switchComponent);
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(switchComponent).toBeChecked();
});
