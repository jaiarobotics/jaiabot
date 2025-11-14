import { JaiaContextType } from "../../types/context-types";
import HistoryBuffer from "./history-buffer";
import { MAX_HISTORY } from "../../utils/constants";

const emptyState = {} as JaiaContextType;
// The history singleton is being initialized with an empty state
// It will be reset by the handleInit of the data-model-handlers
export const jaiaStateHistory = new HistoryBuffer<JaiaContextType>(emptyState, MAX_HISTORY);
