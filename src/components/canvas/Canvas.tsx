import { useCallback } from "react";
import { Tldraw, type Editor } from "tldraw";
import "tldraw/tldraw.css";
import { useCanvas } from "./canvas-context";
import "@/styles/tldraw.css";

export function Canvas() {
  const { setEditor } = useCanvas();

  const handleMount = useCallback(
    (editor: Editor) => {
      setEditor(editor);
      // Light theme to match the editorial warm-paper surface.
      editor.user.updateUserPreferences({ colorScheme: "light" });
      editor.setCurrentTool("draw");
    },
    [setEditor],
  );

  return (
    <div className="absolute inset-0">
      <Tldraw hideUi onMount={handleMount} />
    </div>
  );
}
