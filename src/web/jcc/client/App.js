// React
// Style
import "./style/app.css";

import React from "react";

// Jaia
import { GlobalContextProvider } from "../../context/GlobalContext";
import { PodContextProvider } from "../../context/PodContext";
import { CommandControlWrapper } from "../client/components/CommandControl";

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
