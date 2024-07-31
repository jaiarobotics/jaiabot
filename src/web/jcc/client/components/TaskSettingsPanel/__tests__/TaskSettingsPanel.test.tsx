import { render, screen, fireEvent } from "@testing-library/react";
import {TaskSettingsPanel, Props} from "../TaskSettingsPanel";

const mockProps: Props = {
    enableEcho: false,
}
test("TaskSettingsPanel Renders", () => {
    render(<TaskSettingsPanel {...mockProps}/>);
});