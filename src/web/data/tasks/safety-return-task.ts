import Task from "./task";

/**
 * The constant heading a survey's Bots run when a dive reaches the safety depth, sent as
 * BottomDepthSafetyParams rather than a MissionTask
 */
export default class SafetyReturnTask extends Task {
    constructor() {
        super(true);
    }

    protected isSafetyReturnTask() {
        return true;
    }
}
