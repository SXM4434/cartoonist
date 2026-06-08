import { createContext, useContext, useState, type ReactNode } from "react";
import type { Editor } from "tldraw";

type CanvasContextValue = {
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
};

const CanvasContext = createContext<CanvasContextValue | null>(null);

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  return (
    <CanvasContext.Provider value={{ editor, setEditor }}>
      {children}
    </CanvasContext.Provider>
  );
}

export function useCanvas() {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error("useCanvas must be used inside <CanvasProvider>");
  return ctx;
}
