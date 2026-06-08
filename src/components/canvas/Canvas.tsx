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
      editor.user.updateUserPreferences({ colorScheme: "dark" });
      // Start in draw mode so clicking on the canvas immediately makes marks.
      editor.setCurrentTool("draw");
    },
    [setEditor],
  );

  return (
    <div className="absolute inset-0">
      {/* hideUi keeps tldraw's engine + canvas but hides their toolbar/menus.
          We drive tools from our own header via the editor instance. */}
      <Tldraw hideUi onMount={handleMount} />
    </div>
  );
}
