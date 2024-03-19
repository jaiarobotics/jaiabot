import React from "react";
interface Props {
    checked: () => boolean;
    onClick: () => void;
    disabled?: () => boolean;
    label?: string;
    title?: string;
}
export default function JaiaToggle(props: Props): React.JSX.Element;
export {};
