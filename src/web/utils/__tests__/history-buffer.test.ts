import HistoryBuffer from "../history-buffer";
import { UNASSIGNED_ID } from "../constants";

const maxBuffer = 5;
test("exercise histroy buffer", () => {
    // Initialize a history buffer
    const testHistory = new HistoryBuffer<Number>(0, maxBuffer);
    // Verify Undo and Redo on empty history work
    expect(testHistory.canUndo()).toBe(false);
    expect(testHistory.canRedo()).toBe(false);
    expect(testHistory.undo()).toBeUndefined();
    expect(testHistory.redo()).toBeUndefined();
    expect(testHistory.getPresent()).toBe(0);

    // Push a value onto history buffer
    testHistory.push(1, "1st push");
    let bufferValue = testHistory.getPresent();
    expect(bufferValue).toBe(1);
    expect(testHistory.canUndo()).toBe(true);
    expect(testHistory.canRedo()).toBe(false);
    expect(testHistory.peekUndoDescription()).toBe("1st push");
    expect(testHistory.peekRedoDescription()).toBeUndefined();

    // Push a 2nd value onto buffer
    testHistory.push(2, "2nd push");
    expect(testHistory.getPresent()).toBe(2);

    // // Use Undo to get 1st value
    const undoValue = testHistory.undo();
    expect(undoValue).toBe(1);
    expect(testHistory.peekRedoDescription()).toBe("2nd push");
    expect(testHistory.peekUndoDescription()).toBe("1st push");
    expect(testHistory.canUndo()).toBe(true);
    expect(testHistory.canRedo()).toBe(true);
    expect(testHistory.getPresent()).toBe(1);

    // // Use Redo to get 2nd value
    expect(testHistory.redo()).toBe(2);
    expect(testHistory.peekUndoDescription()).toBe("2nd push");
    expect(testHistory.peekRedoDescription()).toBeUndefined();
    expect(testHistory.canUndo()).toBe(true);
    expect(testHistory.canRedo()).toBe(false);

    // // Fill the history buffer
    testHistory.reset(0);
    for (let i = 1; i <= maxBuffer; i++) {
        testHistory.push(i, "Push " + i);
        expect(testHistory.peekUndoDescription()).toBe("Push " + i);
        expect(testHistory.canRedo()).toBe(false);
    }
    // Push another history entry and verify circular bechavior
    testHistory.push(maxBuffer, "Last Push");
    expect(testHistory.peekUndoDescription()).toBe("Last Push");
    expect(testHistory.canUndo()).toBe(true);
    expect(testHistory.canRedo()).toBe(false);

    // Undo and verify circular behavior
    expect(testHistory.undo()).toBe(maxBuffer);
    expect(testHistory.peekUndoDescription()).toBe("Push " + maxBuffer);
    expect(testHistory.peekRedoDescription()).toBe("Last Push");
    expect(testHistory.canRedo()).toBe(true);
});
