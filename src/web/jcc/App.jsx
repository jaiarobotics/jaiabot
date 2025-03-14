// React
import React from "react";

// Jaia
import { GlobalContextProvider } from "../context/Global/GlobalContext";
import { PodContextProvider } from "../context/Pod/PodContext";
import { CommandControlWrapper } from "../containers/CommandControl/CommandControl";

export default function App() {
    return (
        <div>
            <GlobalContextProvider>
                <PodContextProvider>
                    <CommandControlWrapper />
                </PodContextProvider>
            </GlobalContextProvider>
        </div>
    );
}
