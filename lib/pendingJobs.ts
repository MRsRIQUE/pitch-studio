// Singleton map shared across API route invocations in the same process.
// Keyed by kie.ai taskId → { resolve, reject } for the waiting generate request.
declare global {
  // eslint-disable-next-line no-var
  var __pendingJobs: Map<string, {
    resolve: (imageUrl: string) => void;
    reject:  (error: Error)    => void;
  }>;
}

global.__pendingJobs ??= new Map();

export const pendingJobs = global.__pendingJobs;
