import type { SketchPrimitive } from "./sketch-types";

/**
 * Example scenes for /examples.
 *
 * Rule: one example = one idea. Each scene shows a single meaningful
 * interaction or output, not an entire generated application. Enough
 * context to read the state, nothing more.
 */

const ui = <T extends SketchPrimitive>(shape: T): T => ({ ...shape, style: "ui" });

type Builder = (originX: number, originY: number) => SketchPrimitive[];

function makeKit() {
  const s: SketchPrimitive[] = [];
  const add = (shape: SketchPrimitive) => s.push(ui(shape));
  return {
    out: s,
    rect: (id: string, x: number, y: number, w: number, h: number, tone: SketchPrimitive["tone"] = "surface") =>
      add({ type: "rect", id, x, y, w, h, tone, fill: "solid" }),
    text: (id: string, x: number, y: number, value: string, size = 13, tone: SketchPrimitive["tone"] = "ink") =>
      add({ type: "text", id, x, y, text: value, size, tone }),
    line: (id: string, x1: number, y1: number, x2: number, y2: number, tone: SketchPrimitive["tone"] = "muted") =>
      add({ type: "line", id, x1, y1, x2, y2, tone }),
    arrow: (id: string, x1: number, y1: number, x2: number, y2: number, tone: SketchPrimitive["tone"] = "muted") =>
      add({ type: "arrow", id, x1, y1, x2, y2, tone }),
    ellipse: (id: string, x: number, y: number, w: number, h: number, tone: SketchPrimitive["tone"] = "muted") =>
      add({ type: "ellipse", id, x, y, w, h, tone, fill: "solid" }),
  };
}

/** Billing: just enough nav to place you, the invoice table, and the downgrade confirm. */
const billing: Builder = (ox, oy) => {
  const k = makeKit();
  k.text("b_crumb", ox, oy, "Settings / Billing", 11, "muted");
  ["General", "Members", "Billing", "Security"].forEach((label, i) => {
    const x = ox + i * 108;
    k.text(`b_nav_${i}`, x, oy + 30, label, 13, label === "Billing" ? "ink" : "muted");
    if (label === "Billing") k.line("b_nav_active", x, oy + 52, x + 58, oy + 52, "accent");
  });
  k.line("b_nav_rule", ox, oy + 56, ox + 940, oy + 56);

  k.text("b_title", ox, oy + 84, "Invoices", 22);
  k.text("b_sub", ox, oy + 116, "Studio plan — 12 of 20 seats", 13, "muted");

  const tableW = 540;
  ["INVOICE", "DATE", "AMOUNT", "STATUS"].forEach((h, i) =>
    k.text(`b_th_${i}`, ox + [0, 170, 310, 430][i], oy + 162, h, 11, "muted"),
  );
  k.line("b_th_rule", ox, oy + 184, ox + tableW, oy + 184);
  [
    ["INV-2094", "Aug 1, 2026", "$240.00", "Paid"],
    ["INV-2081", "Jul 1, 2026", "$240.00", "Paid"],
    ["INV-2070", "Jun 1, 2026", "$200.00", "Paid"],
    ["INV-2061", "May 1, 2026", "$200.00", "Refunded"],
  ].forEach((row, i) => {
    const y = oy + 206 + i * 46;
    k.text(`b_id_${i}`, ox, y, row[0], 13);
    k.text(`b_date_${i}`, ox + 170, y, row[1], 13, "muted");
    k.text(`b_amt_${i}`, ox + 310, y, row[2], 13);
    k.text(`b_st_${i}`, ox + 430, y, row[3], 11, row[3] === "Refunded" ? "danger" : "muted");
    k.line(`b_row_rule_${i}`, ox, y + 28, ox + tableW, y + 28);
  });

  // The single interaction: confirming a downgrade. Sits beside the table so
  // neither the table nor the decision has to be read through the other.
  const mx = ox + tableW + 80;
  const my = oy + 184;
  k.rect("b_modal", mx, my, 320, 190, "surface");
  k.text("b_modal_t", mx + 24, my + 26, "Downgrade to Team?", 22);
  k.text("b_modal_b", mx + 24, my + 74, "You lose 8 seats on Sep 1.", 13, "muted");
  k.line("b_modal_rule", mx, my + 124, mx + 320, my + 124);
  k.text("b_modal_cancel", mx + 40, my + 150, "Cancel", 13, "muted");
  k.rect("b_modal_ok", mx + 200, my + 142, 96, 30, "danger");
  k.text("b_modal_ok_t", mx + 214, my + 150, "Downgrade", 11, "surface");
  return k.out;
};

/** Command center: one command interaction, nothing else. */
const command: Builder = (ox, oy) => {
  const k = makeKit();
  k.text("c_ctx", ox, oy, "Atlas — Projects", 13, "muted");
  k.line("c_ctx_rule", ox, oy + 22, ox + 660, oy + 22);

  k.rect("c_field", ox, oy + 60, 660, 56, "surface");
  k.text("c_query", ox + 22, oy + 78, "move billing → Q3", 22);
  k.line("c_caret", ox + 250, oy + 74, ox + 250, oy + 100, "accent");
  k.text("c_hint", ox + 560, oy + 84, "⌘K", 11, "muted");

  [
    ["Move milestone", "Billing revamp → Q3 2026", true],
    ["Reassign owner", "Billing revamp — Dev", false],
    ["Create decision", "Log 'ship guided session first'", false],
  ].forEach((row, i) => {
    const y = oy + 132 + i * 62;
    if (row[2]) k.rect("c_row_active", ox, y - 12, 660, 56, "subtle");
    if (row[2]) k.line("c_row_bar", ox, y - 12, ox, y + 44, "accent");
    k.text(`c_row_t_${i}`, ox + 22, y, String(row[0]), 15);
    k.text(`c_row_s_${i}`, ox + 22, y + 22, String(row[1]), 11, "muted");
    if (row[2]) k.text("c_row_enter", ox + 600, y + 8, "↵", 13, "muted");
  });
  k.text("c_foot", ox, oy + 340, "3 actions matched", 11, "muted");
  return k.out;
};

/** Order ops: one order, one state machine. */
const orderOps: Builder = (ox, oy) => {
  const k = makeKit();
  k.text("o_eyebrow", ox, oy, "ORDER #40912", 11, "muted");
  k.text("o_title", ox, oy + 22, "Held for review", 32);
  k.text("o_meta", ox, oy + 74, "€412.00 · 3 items · flagged by fraud rule R-14", 13, "muted");

  const steps = ["Placed", "Paid", "Review", "Picked", "Shipped"];
  steps.forEach((s, i) => {
    const x = ox + i * 150;
    const active = i === 2;
    const done = i < 2;
    k.ellipse(`o_dot_${i}`, x, oy + 140, 18, 18, active ? "accent" : done ? "ink" : "muted");
    if (i < steps.length - 1) k.line(`o_link_${i}`, x + 18, oy + 149, x + 150, oy + 149, done ? "ink" : "muted");
    k.text(`o_step_${i}`, x, oy + 174, s, 13, active ? "ink" : "muted");
    if (active) k.text("o_step_meta", x, oy + 196, "12m in state", 11, "muted");
  });

  k.line("o_rule", ox, oy + 240, ox + 690, oy + 240);
  k.text("o_q", ox, oy + 266, "Release the hold?", 15);
  k.rect("o_release", ox, oy + 296, 132, 36, "accent");
  k.text("o_release_t", ox + 30, oy + 306, "Release", 13, "surface");
  k.text("o_cancel", ox + 160, oy + 306, "Cancel order", 13, "danger");
  return k.out;
};

/** Workflow editor: one flow composition. */
const workflow: Builder = (ox, oy) => {
  const k = makeKit();
  k.text("w_eyebrow", ox, oy, "FLOW — SESSION RECAP", 11, "muted");

  const node = (id: string, x: number, y: number, title: string, sub: string, tone: SketchPrimitive["tone"] = "surface") => {
    k.rect(`${id}_box`, x, y, 190, 74, tone);
    k.text(`${id}_t`, x + 16, y + 18, title, 15);
    k.text(`${id}_s`, x + 16, y + 44, sub, 11, "muted");
  };

  node("w_a", ox, oy + 60, "Transcript", "live audio in");
  node("w_b", ox + 260, oy + 60, "Mark phrases", "attention pass", "subtle");
  node("w_c", ox + 520, oy - 10, "Draw structure", "canvas objects");
  node("w_d", ox + 520, oy + 130, "Open questions", "3 unresolved");
  node("w_e", ox + 780, oy + 60, "Recap document", "markdown out", "accent");

  k.arrow("w_ab", ox + 190, oy + 97, ox + 260, oy + 97);
  k.arrow("w_bc", ox + 450, oy + 90, ox + 520, oy + 30);
  k.arrow("w_bd", ox + 450, oy + 104, ox + 520, oy + 164);
  k.arrow("w_ce", ox + 710, oy + 30, ox + 780, oy + 90);
  k.arrow("w_de", ox + 710, oy + 164, ox + 780, oy + 104);
  k.text("w_note", ox + 260, oy + 172, "runs every 8s while the room talks", 11, "muted");
  return k.out;
};

/** Mobile: one focused task on one screen. */
const mobile: Builder = (ox, oy) => {
  const k = makeKit();
  k.rect("p_frame", ox, oy, 340, 680, "surface");
  k.text("p_time", ox + 22, oy + 16, "9:41", 11, "muted");
  k.line("p_status_rule", ox, oy + 44, ox + 340, oy + 44);
  k.text("p_back", ox + 20, oy + 64, "‹", 15, "muted");
  k.text("p_title", ox + 44, oy + 66, "Assign action items", 15);
  k.line("p_head_rule", ox, oy + 96, ox + 340, oy + 96);

  [
    ["Seed the room with real data", "Dev", true],
    ["Write the guided script", "Priya", true],
    ["Cut the empty state", "Unassigned", false],
  ].forEach((row, i) => {
    const y = oy + 128 + i * 104;
    k.rect(`p_card_${i}`, ox + 20, y, 300, 84, row[2] ? "surface" : "subtle");
    if (!row[2]) k.line("p_card_bar", ox + 20, y, ox + 20, y + 84, "accent");
    k.text(`p_card_t_${i}`, ox + 38, y + 18, String(row[0]), 13);
    k.text(`p_card_s_${i}`, ox + 38, y + 48, String(row[1]), 11, row[2] ? "muted" : "accent");
  });

  k.text("p_hint", ox + 20, oy + 452, "1 item still needs an owner", 11, "muted");
  k.rect("p_cta", ox + 20, oy + 592, 300, 48, "accent");
  k.text("p_cta_t", ox + 108, oy + 608, "Send to Linear", 13, "surface");
  return k.out;
};

export type Blueprint = {
  id: string;
  label: string;
  /** The single idea this example demonstrates. */
  blurb: string;
  /** Machine metadata shown under the artifact. */
  output: string;
  build: Builder;
};

export const BLUEPRINTS: Blueprint[] = [
  { id: "command", label: "Command center", blurb: "One command, three matched actions.", output: "app state", build: command },
  { id: "commerce", label: "Order ops", blurb: "One order held mid-workflow.", output: "operational state", build: orderOps },
  { id: "editor", label: "Workflow editor", blurb: "One flow, five nodes.", output: "flow diagram", build: workflow },
  { id: "mobile", label: "Mobile app", blurb: "One focused mobile task.", output: "mobile screen", build: mobile },
  { id: "settings", label: "Billing settings", blurb: "Invoices, and one confirmation.", output: "settings screen", build: billing },
];
