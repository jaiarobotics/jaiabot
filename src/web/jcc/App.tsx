// Jaia
import { GlobalContextProvider } from "../context/Global/GlobalContext";
import { JaiaSystemContextProvider } from "../context/JaiaSystem/JaiaSystemContext";

// Style
import "./App.less";
import Map from "../components/Map/Map";
import { NodeList } from "../containers/NodeList/NodeList";

export default function App() {
    return (
        <div id="jcc">
            <GlobalContextProvider>
                <JaiaSystemContextProvider>
                    <Map />
                    <NodeList />
                </JaiaSystemContextProvider>
            </GlobalContextProvider>
        </div>
    );
}
