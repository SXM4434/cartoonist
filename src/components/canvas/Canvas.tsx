import { useCallback } from "react";
import {
  ArrowShapeTool,
  DrawShapeTool,
  EraserTool,
  FrameShapeTool,
  GeoShapeTool,
  HandTool,
  NoteShapeTool,
  SelectTool,
  TextShapeTool,
  TldrawEditor,
  defaultBindingUtils,
  defaultShapeUtils,
  type Editor,
} from "tldraw";
import { useCanvas } from "./canvas-context";
import "@/styles/tldraw.css";

const tools = [
  SelectTool,
  HandTool,
  DrawShapeTool,
  EraserTool,
  ArrowShapeTool,
  TextShapeTool,
  NoteShapeTool,
  GeoShapeTool,
  FrameShapeTool,
];

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
      <TldrawEditor
        shapeUtils={defaultShapeUtils}
        bindingUtils={defaultBindingUtils}
        tools={tools}
        initialState="select"
        colorScheme="dark"
        onMount={handleMount}
      />
    </div>
  );
}
