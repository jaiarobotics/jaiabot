import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OlFeature from "ol/Feature";
import { Point } from "ol/geom";
import { RallyPointPanel, Props } from "../RallyPointPanel";

const mockGoToRallyPoint = jest.fn();
const mockDeleteRallyPoint = jest.fn();
const mockSetVisiblePanel = jest.fn();
const mockSelectedRallyFeature = new OlFeature<Point>({
    geometry: new Point([123.45, 678.9]),
});

const mockProps: Props = {
    selectedRallyFeature: mockSelectedRallyFeature,
    goToRallyPoint: mockGoToRallyPoint,
    deleteRallyPoint: mockDeleteRallyPoint,
    setVisiblePanel: mockSetVisiblePanel,
};

type TestParams = {
    description: string;
    getMethod: () => HTMLElement;
    callBackMethod: () => jest.Mock;
};

const testCases: TestParams[] = [
    {
        // getByTestId should be used as last resort
        description: "Test Go To Button using test-id",
        getMethod: () => screen.getByTestId("go-to-rally-point-id"),
        callBackMethod: mockGoToRallyPoint,
    },
    {
        description: "Test Go To Button using label",
        getMethod: () => screen.getByLabelText("Go To Rally Point Label"),
        callBackMethod: mockGoToRallyPoint,
    },
    {
        description: "Test Go To Button using title",
        getMethod: () => screen.getByTitle("Go To Rally Point Button"),
        callBackMethod: mockGoToRallyPoint,
    },
    {
        // getByTestId should be used as last resort
        description: "Test Delete Button using test-id",
        getMethod: () => screen.getByTestId("delete-rally-point-id"),
        callBackMethod: mockDeleteRallyPoint,
    },
    {
        description: "Test Delete Button using label",
        getMethod: () => screen.getByLabelText("Delete Rally Point Label"),
        callBackMethod: mockDeleteRallyPoint,
    },
    {
        description: "Test Delete Button using title",
        getMethod: () => screen.getByTitle("Delete Rally Point Button"),
        callBackMethod: mockDeleteRallyPoint,
    },
];

describe("RallyPointPanel: Button Interaction Tests", () => {
    beforeEach(() => {
        // Ensure a clean state for each test
        jest.clearAllMocks();
    });
    test.each(testCases)("$description", async ({ getMethod, callBackMethod }) => {
        // Examples of testing buttons using various get methods

        // Render the Rally Point Panel with mock props
        render(<RallyPointPanel {...mockProps} />);

        // Get the button using the provided getMethod
        const buttonElement = getMethod();
        expect(buttonElement).toBeInTheDocument();

        // Click the button
        await userEvent.click(buttonElement);

        // Verify that the callback was called with the correct argument
        await waitFor(() => {
            expect(callBackMethod).toHaveBeenCalledTimes(1);
            expect(callBackMethod).toHaveBeenLastCalledWith(mockProps.selectedRallyFeature);
        });
    });
});
