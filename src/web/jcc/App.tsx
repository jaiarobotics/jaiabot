// React
import React from "react";

// Jaia
import { GlobalContextProvider } from "../context/Global/GlobalContext";
import { JaiaSystemContextProvider } from "../context/JaiaSystem/JaiaSystemContext";
import { CommandControlWrapper } from "../containers/CommandControl/CommandControl";
import DataOffloadButton from "../components/DataOffloadButton/DataOffloadButton";

export default function App() {
    return (
        <div>
            <GlobalContextProvider>
                <JaiaSystemContextProvider>
                    <DataOffloadButton />
                </JaiaSystemContextProvider>
            </GlobalContextProvider>
        </div>
    );
}
