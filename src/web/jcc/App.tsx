// React
import React from "react";

// Jaia
import { GlobalContextProvider } from "../context/Global/GlobalContext";
import { JaiaSystemContextProvider } from "../context/JaiaSystem/JaiaSystemContext";
import { CommandControlWrapper } from "../containers/CommandControl/CommandControl";

export default function App() {
    return (
        <div>
            <GlobalContextProvider>
                <JaiaSystemContextProvider>
                    <CommandControlWrapper />
                </JaiaSystemContextProvider>
            </GlobalContextProvider>
        </div>
    );
}
