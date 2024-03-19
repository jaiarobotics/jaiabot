import React from 'react';
import { RunInterface } from "./CommandControl";
interface Props {
    onClick: (evt: React.ChangeEvent, run: RunInterface) => void;
    runIdInEditMode: string;
    run: RunInterface;
    label: string;
    title: string;
    isDisabled?: boolean;
}
export default function EditModeToggle(props: Props): React.JSX.Element;
export {};
