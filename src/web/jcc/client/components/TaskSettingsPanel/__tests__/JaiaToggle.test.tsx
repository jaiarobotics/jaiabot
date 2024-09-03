import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JaiaTogglePage from "../JaiaTogglePage";
import { log } from "console";

test("flipping switch changes boolean", async () => {
    render(<JaiaTogglePage />);
    const switchComponent = screen.getByRole("checkbox");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    userEvent.click(screen.getByRole("checkbox"));
    log(switchComponent);
    //expect(screen.getByText(/true/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
});
