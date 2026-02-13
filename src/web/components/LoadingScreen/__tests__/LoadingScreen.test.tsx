import { render, screen } from "@testing-library/react";
import LoadingScreen from "../LoadingScreen";

describe("LoadingScreen Component", () => {
    test("renders loading screen with logo and text", () => {
        render(<LoadingScreen />);

        // Check for loading text
        const loadingText = screen.getByText(/Loading Jaia Command & Control/i);
        expect(loadingText).toBeInTheDocument();

        // Check for logo image
        const logo = screen.getByAltText("Jaiabot Logo");
        expect(logo).toBeInTheDocument();
    });

    test("loading screen has correct CSS classes", () => {
        const { container } = render(<LoadingScreen />);

        // Check for main loading screen container
        const loadingScreen = container.querySelector(".loading-screen");
        expect(loadingScreen).toBeInTheDocument();

        // Check for loading content
        const loadingContent = container.querySelector(".loading-content");
        expect(loadingContent).toBeInTheDocument();

        // Check for loading bar
        const loadingBar = container.querySelector(".loading-bar");
        expect(loadingBar).toBeInTheDocument();
    });
});
