import { createContext, useContext, useState, type ReactNode } from "react";
import type { Editor } from "tldraw";

type CanvasContextValue = {
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
};

const CanvasContext = createContext<CanvasContextValue | null>(null);

// Module-level handle so surfaces rendered outside <CanvasProvider>
// (header actions, export sheet) can still reach the tldraw editor.
let editorHandle: Editor | null = null;
export function getCanvasEditor() {
  return editorHandle;
}

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [editor, setEditorState] = useState<Editor | null>(null);
  const setEditor = (next: Editor | null) => {
    editorHandle = next;
    setEditorState(next);
  };
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
