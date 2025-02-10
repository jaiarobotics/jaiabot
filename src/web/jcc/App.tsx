// React
import React from "react";

// Jaia
import { CommandControlWrapper } from "../containers/CommandControl/CommandControl";
import { GlobalContextProvider } from "../context/Global/GlobalContext";
import { JaiaSystemContextProvider } from "../context/JaiaSystem/JaiaSystemContext";

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
