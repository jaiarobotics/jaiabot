// React
import React from "react";

// Jaia
import { GlobalContextProvider } from "../context/Global/GlobalContext";
import { JaiaContextProvider } from "../context/Jaia/JaiaContext";
import { CommandControlWrapper } from "../containers/CommandControl/CommandControl";

// Style
import "./App.less";

export default function App() {
    return (
        <div id="jcc">
            <GlobalContextProvider>
                <JaiaContextProvider>
                    <CommandControlWrapper />
                </JaiaContextProvider>
            </GlobalContextProvider>
        </div>
    );
}
