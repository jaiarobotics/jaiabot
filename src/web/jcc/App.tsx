// React
import React from "react";

// Jaia
import { GlobalContextProvider } from "../context/Global/GlobalContext";
import { JaiaSystemContextProvider } from "../context/JaiaSystem/JaiaSystemContext";
import { CommandControlWrapper } from "../containers/CommandControl/CommandControl";

// Style
import "./App.less";

export default function App() {
    return (
        <div id="jcc">
            <GlobalContextProvider>
                <JaiaSystemContextProvider>
                    <CommandControlWrapper />
                </JaiaSystemContextProvider>
            </GlobalContextProvider>
        </div>
    );
}
