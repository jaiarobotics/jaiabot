import { createPortal } from "react-dom";

interface ObstacleAvoidanceBaseDialogProps {
    title: string;
    children: React.ReactNode;
    buttons: { label: string; onClick: () => void }[];
}

export default function ObstacleAvoidanceBaseDialog({
    title,
    children,
    buttons,
}: ObstacleAvoidanceBaseDialogProps) {
    // Rendered on the body so a positioned panel cannot stack above it
    return createPortal(
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" />
            <div className="jaia-dialog">
                <h1>{title}</h1>
                {children}
                <div className="dialog-button-row">
                    {buttons.map((b) => (
                        <button key={b.label} className="dialog-button" onClick={b.onClick}>
                            {b.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>,
        document.body,
    );
}
