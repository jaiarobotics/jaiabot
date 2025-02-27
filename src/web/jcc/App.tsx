// Jaia
import { JaiaContextProvider } from "../context/Jaia/JaiaContext";
import { CommandControlWrapper } from "../containers/CommandControl/CommandControl";

// Style
import "./App.less";

export default function App() {
    return (
        <div id="jcc">
            <JaiaContextProvider>
                <CommandControlWrapper />
            </JaiaContextProvider>
        </div>
    );
}
