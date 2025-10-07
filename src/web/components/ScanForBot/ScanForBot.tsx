import "./ScanForBot.less";

export default function ScanForBot() {
    return (
        <div className="scan-for-bot-container">
            <div className="heading">Scan For Bot</div>
            <div className="bot-select-container">
                <div>Bot:</div>
                <div>1</div>
            </div>
            <button>Scan For Bot</button>
            <button>Scan For All Bots</button>
        </div>
    );
}
