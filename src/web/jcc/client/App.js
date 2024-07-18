// React
import React from "react";

// Jaia
import { GlobalContextProvider } from "../../context/GlobalContext";
import { PodContextProvider } from "../../context/PodContext";
import { CommandControlWrapper } from "./components/CommandControl/CommandControl";

// Style
import "./style/app.css";

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
