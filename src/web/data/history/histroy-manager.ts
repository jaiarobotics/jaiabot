import { JaisSnapshot } from "../../types/context-types";
import { MAX_HISTORY } from "../../utils/constants";
import HistoryBuffer from "./history-buffer";

export const historyManager = new HistoryBuffer<JaisSnapshot>(MAX_HISTORY);
