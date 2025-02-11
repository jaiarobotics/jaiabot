// React
import React from "react";

// Jaia
import Map from "../components/Map/Map";
import { GlobalContextProvider } from "../context/Global/GlobalContext";
import { JaiaSystemContextProvider } from "../context/JaiaSystem/JaiaSystemContext";

// Style
import "./App.less";

export default function App() {
    return (
        <div id="jcc">
            <GlobalContextProvider>
                <JaiaSystemContextProvider>
                    <Map />
                </JaiaSystemContextProvider>
            </GlobalContextProvider>
        </div>
    );
}
