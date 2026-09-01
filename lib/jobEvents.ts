import { EventEmitter } from "events";

// In-process event bus: callback route emits, job-stream route listens.
// Works because jobStore is file-backed (survives restarts) and a single
// server process handles both routes.
const jobEvents = new EventEmitter();
jobEvents.setMaxListeners(500);

export { jobEvents };
