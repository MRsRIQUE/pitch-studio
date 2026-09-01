import { createContext, useContext } from "react";

export const ReadOnlyCtx = createContext(false);
export const useReadOnly = () => useContext(ReadOnlyCtx);
