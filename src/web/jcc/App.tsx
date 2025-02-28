// Jaia
import { JaiaContextProvider } from "../context/Jaia/JaiaContext";
import { CommandControlWrapper } from "../containers/CommandControl/CommandControl";
import MissionsPanel from "../containers/MissionsPanel/MissionsPanel";
// Style
import "./App.less";

export default function App() {
    return (
        <div id="jcc">
            <JaiaContextProvider>
                <MissionsPanel />
            </JaiaContextProvider>
        </div>
    );
}
