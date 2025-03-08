import { validateTask } from "./validate-task";
import { MissionTask, TaskType } from "../../../../shared/JAIAProtobuf";
import testCases from "../cases/missionTaskTestCases.json";

type TaskParams = {
    description: string;
    task: MissionTask;
};

type TaskTestCases = {
    validTaskTestCases: TaskParams[];
    invalidTaskTestCases: TaskParams[];
};

const validTaskTestCases = (testCases as TaskTestCases).validTaskTestCases;
const invalidTaskTestCases = (testCases as TaskTestCases).invalidTaskTestCases;

describe("ValidateTask Unit Tests", () => {
    test.each(validTaskTestCases)("$description", ({ task }) => {
        validateTask(task);
    });
    test.each(invalidTaskTestCases)("$description", ({ task }) => {
        expect(() => validateTask(task)).toThrow();
    });
});
