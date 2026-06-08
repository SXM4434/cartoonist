import { useCallback } from "react";
import { Tldraw, type Editor } from "tldraw";
import { useCanvas } from "./canvas-context";
import "@/styles/tldraw.css";

export function Canvas() {
  const { setEditor } = useCanvas();

  const handleMount = useCallback(
    (editor: Editor) => {
      setEditor(editor);
      // Sensible defaults — dark theme to match editorial off-black surfaces.
      editor.user.updateUserPreferences({ colorScheme: "dark" });
    },
    [setEditor],
  );

  return (
    <div className="absolute inset-0">
      <Tldraw hideUi onMount={handleMount} />
    </div>
  );
}
