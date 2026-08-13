import type { IconKind, SketchPrimitive } from "./sketch-types";
import { createProductionWireframe } from "./production-wireframe";

const ui = <T extends SketchPrimitive>(shape: T): T => ({ ...shape, style: "ui" });

type Builder = (originX: number, originY: number) => SketchPrimitive[];

function makeKit() {
  const s: SketchPrimitive[] = [];
  const add = (shape: SketchPrimitive) => s.push(ui(shape));
  return {
    out: s,
    rect: (id: string, x: number, y: number, w: number, h: number, tone: SketchPrimitive["tone"] = "surface", fill = "solid") =>
      add({ type: "rect", id, x, y, w, h, tone, fill }),
    text: (id: string, x: number, y: number, value: string, size = 13, tone: SketchPrimitive["tone"] = "ink") =>
      add({ type: "text", id, x, y, text: value, size, tone }),
    line: (id: string, x1: number, y1: number, x2: number, y2: number, tone: SketchPrimitive["tone"] = "muted") =>
      add({ type: "line", id, x1, y1, x2, y2, tone }),
    icon: (id: string, kind: IconKind, x: number, y: number, size = 14, tone: SketchPrimitive["tone"] = "muted") =>
      add({ type: "icon", id, kind, x, y, size, tone }),
    ellipse: (id: string, x: number, y: number, w: number, h: number, tone: SketchPrimitive["tone"] = "muted") =>
      add({ type: "ellipse", id, x, y, w, h, tone, fill: "solid" }),
  };
}

/** Max-fidelity mobile app: three stacked device frames with real chrome. */
const mobileApp: Builder = (ox, oy) => {
  const k = makeKit();
  const screens: Array<{ title: string; kind: "feed" | "detail" | "profile" }> = [
    { title: "Today", kind: "feed" },
    { title: "Session", kind: "detail" },
    { title: "You", kind: "profile" },
  ];
  screens.forEach((screen, si) => {
    const x = ox + si * 400;
    const y = oy;
    k.rect(`m${si}_frame`, x, y, 340, 700, "surface");
    // status bar
    k.text(`m${si}_time`, x + 22, y + 14, "9:41", 11);
    k.line(`m${si}_status_rule`, x, y + 40, x + 340, y + 40);
    // nav header
    k.text(`m${si}_title`, x + 128, y + 56, screen.title, 15);
    k.line(`m${si}_head_rule`, x, y + 88, x + 340, y + 88);

    if (screen.kind === "feed") {
      k.rect(`m${si}_seg`, x + 20, y + 104, 300, 32, "subtle");
      k.rect(`m${si}_seg_active`, x + 22, y + 106, 98, 28, "surface");
      ["Live", "Queued", "Done"].forEach((t, i) => k.text(`m${si}_seg_${i}`, x + 46 + i * 100, y + 113, t, 11, i === 0 ? "ink" : "muted"));
      [["Kickoff sync", "4 people • 12 min", "LIVE"], ["Pricing review", "3 people • 40 min", "2h"], ["Design crit", "6 people • 25 min", "Yest."], ["Roadmap Q3", "5 people • 55 min", "Mon"]].forEach((row, i) => {
        const ry = y + 156 + i * 96;
        k.rect(`m${si}_card_${i}`, x + 20, ry, 300, 84, i === 0 ? "subtle" : "surface");
        if (i === 0) k.rect(`m${si}_card_accent_${i}`, x + 20, ry, 3, 84, "accent");
        k.ellipse(`m${si}_card_av_${i}`, x + 36, ry + 16, 30, 30, i === 0 ? "accent" : "muted");
        k.text(`m${si}_card_t_${i}`, x + 78, ry + 18, row[0], 13);
        k.text(`m${si}_card_s_${i}`, x + 78, ry + 40, row[1], 11, "muted");
        k.text(`m${si}_card_b_${i}`, x + 258, ry + 18, row[2], 11, i === 0 ? "success" : "muted");
      });
      k.ellipse(`m${si}_fab`, x + 258, y + 556, 54, 54, "accent");
    }

    if (screen.kind === "detail") {
      k.rect(`m${si}_hero`, x + 20, y + 104, 300, 132, "subtle");
      k.text(`m${si}_hero_eyebrow`, x + 36, y + 118, "IN PROGRESS", 11, "accent");
      k.text(`m${si}_hero_title`, x + 36, y + 140, "Pricing review", 22);
      k.text(`m${si}_hero_meta`, x + 36, y + 178, "Started 12:04 • 3 speakers", 11, "muted");
      [0, 1, 2].forEach((i) => k.ellipse(`m${si}_hero_av_${i}`, x + 36 + i * 24, y + 200, 24, 24, i === 1 ? "accent" : "muted"));
      k.text(`m${si}_sec1`, x + 20, y + 256, "TRANSCRIPT", 11, "muted");
      [["Maya", "We should anchor on value, not seats."], ["Theo", "Enterprise wants a flat tier."], ["Amara", "Blocked on the billing migration."]].forEach((row, i) => {
        const ry = y + 282 + i * 76;
        k.ellipse(`m${si}_t_av_${i}`, x + 20, ry, 22, 22, i === 2 ? "danger" : "muted");
        k.text(`m${si}_t_name_${i}`, x + 52, ry, row[0], 11, "muted");
        k.text(`m${si}_t_body_${i}`, x + 52, ry + 20, row[1], 13);
        k.line(`m${si}_t_rule_${i}`, x + 20, ry + 56, x + 320, ry + 56);
      });
      k.rect(`m${si}_cta`, x + 20, y + 528, 300, 44, "accent");
      k.text(`m${si}_cta_text`, x + 118, y + 542, "Summarize session", 13, "surface");
      k.rect(`m${si}_cta2`, x + 20, y + 584, 300, 44, "surface");
      k.text(`m${si}_cta2_text`, x + 138, y + 598, "Share recap", 13);
    }

    if (screen.kind === "profile") {
      k.ellipse(`m${si}_avatar`, x + 132, y + 116, 76, 76, "accent");
      k.text(`m${si}_name`, x + 122, y + 208, "Maya Chen", 22);
      k.text(`m${si}_role`, x + 116, y + 242, "Product design • Berlin", 11, "muted");
      [["Sessions", "128"], ["Hours", "94"], ["Decisions", "412"]].forEach((m, i) => {
        k.text(`m${si}_stat_v_${i}`, x + 40 + i * 100, y + 280, m[1], 22);
        k.text(`m${si}_stat_l_${i}`, x + 40 + i * 100, y + 310, m[0], 11, "muted");
      });
      k.line(`m${si}_p_rule`, x + 20, y + 344, x + 320, y + 344);
      ["Voice sample", "Contribution modes", "Feedback style", "Notifications", "Privacy", "Sign out"].forEach((label, i) => {
        const ry = y + 368 + i * 46;
        k.text(`m${si}_p_label_${i}`, x + 24, ry - 1, label, 13, i === 5 ? "danger" : "ink");
        k.text(`m${si}_p_chev_${i}`, x + 300, ry - 1, "›", 13, "muted");
        k.line(`m${si}_p_row_rule_${i}`, x + 20, ry + 26, x + 320, ry + 26);
      });
    }

    // tab bar
    k.line(`m${si}_tab_rule`, x, y + 636, x + 340, y + 636);
    ["Home", "Stats", "Rooms", "You"].forEach((label, i) => {
      const activeTab = si === 0 ? 0 : si === 1 ? 2 : 3;
      if (i === activeTab) k.rect(`m${si}_tab_active_${i}`, x + 26 + i * 78, y + 650, 62, 26, "accent");
      k.text(`m${si}_tab_label_${i}`, x + 40 + i * 78, y + 656, label, 11, i === activeTab ? "ink" : "muted");
    });
    k.rect(`m${si}_home_ind`, x + 130, y + 692, 80, 4, "muted");
    k.text(`m${si}_caption`, x + 4, y + 716, `${si + 1} / 3 — ${screen.title}`, 11, "muted");
  });
  return k.out;
};

/** Max-fidelity settings/billing surface with nested panels and a modal. */
const settingsBilling: Builder = (ox, oy) => {
  const k = makeKit();
  k.rect("st_frame", ox, oy, 1120, 720, "surface");
  k.rect("st_top", ox, oy, 1120, 48, "surface");
  k.line("st_top_rule", ox, oy + 48, ox + 1120, oy + 48);
  k.text("st_brand", ox + 20, oy + 14, "Atlas Work", 15);
  k.text("st_crumb", ox + 140, oy + 16, "Settings  /  Billing", 11, "muted");
  k.rect("st_save", ox + 972, oy + 9, 128, 30, "accent");
  k.text("st_save_text", ox + 996, oy + 16, "Save changes", 11, "surface");

  k.rect("st_side", ox, oy + 49, 216, 671, "subtle");
  k.text("st_side_label", ox + 20, oy + 72, "SETTINGS", 11, "muted");
  ["General", "Members", "Roles", "Billing", "Integrations", "Voice & audio", "Security", "Audit log"].forEach((label, i) => {
    const y = oy + 100 + i * 40;
    if (label === "Billing") {
      k.rect("st_side_active_bg", ox + 10, y - 8, 196, 32, "surface");
      k.rect("st_side_active", ox + 10, y - 8, 3, 32, "accent");
    }
    k.text(`st_side_${i}`, ox + 26, y - 2, label, 13, label === "Billing" ? "ink" : "muted");
  });
  k.line("st_side_rule", ox + 216, oy + 49, ox + 216, oy + 720);

  const cx = ox + 248;
  k.text("st_title", cx, oy + 84, "Billing & usage", 32);
  k.text("st_sub", cx, oy + 128, "Plan, invoices, and AI spend for this workspace", 13, "muted");

  k.rect("st_plan", cx, oy + 164, 540, 152, "subtle");
  k.text("st_plan_eyebrow", cx + 20, oy + 182, "CURRENT PLAN", 11, "accent");
  k.text("st_plan_name", cx + 20, oy + 206, "Studio — $240 / mo", 22);
  k.text("st_plan_meta", cx + 20, oy + 246, "Renews Sep 1 • 12 of 20 seats used", 11, "muted");
  k.rect("st_plan_bar_bg", cx + 20, oy + 272, 320, 8, "muted");
  k.rect("st_plan_bar", cx + 20, oy + 272, 192, 8, "accent");
  k.rect("st_plan_btn", cx + 396, oy + 264, 124, 32, "surface");
  k.text("st_plan_btn_text", cx + 420, oy + 272, "Change plan", 11);

  k.rect("st_usage", cx + 564, oy + 164, 292, 152, "surface");
  k.text("st_usage_title", cx + 584, oy + 182, "AI spend", 15);
  k.text("st_usage_value", cx + 584, oy + 210, "$38.42", 32);
  k.text("st_usage_delta", cx + 584, oy + 254, "+6.1% vs last month", 11, "success");
  [0, 1, 2, 3, 4, 5, 6].forEach((i) =>
    k.rect(`st_usage_bar_${i}`, cx + 584 + i * 30, oy + 292 - (10 + i * 4), 18, 10 + i * 4, i === 6 ? "accent" : "muted"),
  );

  k.text("st_inv_title", cx, oy + 352, "Invoices", 22);
  k.rect("st_inv_filter", cx + 660, oy + 350, 196, 30, "surface");
  k.icon("st_inv_filter_icon", "search", cx + 672, oy + 358, 12);
  k.text("st_inv_filter_text", cx + 694, oy + 357, "Filter invoices…", 11, "muted");
  k.line("st_inv_head", cx, oy + 396, cx + 856, oy + 396);
  ["INVOICE", "DATE", "SEATS", "AMOUNT", "STATUS", ""].forEach((h, i) =>
    k.text(`st_th_${i}`, cx + [0, 190, 330, 448, 580, 760][i], oy + 408, h, 11, "muted"),
  );
  [["INV-2094", "Aug 1, 2026", "12", "$240.00", "Paid"], ["INV-2081", "Jul 1, 2026", "12", "$240.00", "Paid"], ["INV-2070", "Jun 1, 2026", "10", "$200.00", "Paid"], ["INV-2061", "May 1, 2026", "10", "$200.00", "Refunded"], ["INV-2050", "Apr 1, 2026", "8", "$160.00", "Paid"]].forEach((row, i) => {
    const y = oy + 440 + i * 48;
    if (i === 0) k.rect(`st_row_hl_${i}`, cx, y - 12, 856, 46, "subtle");
    k.icon(`st_row_icon_${i}`, "doc", cx, y - 2, 13);
    k.text(`st_row_id_${i}`, cx + 22, y, row[0], 13);
    k.text(`st_row_date_${i}`, cx + 190, y, row[1], 11, "muted");
    k.text(`st_row_seats_${i}`, cx + 330, y, row[2], 11, "muted");
    k.text(`st_row_amt_${i}`, cx + 448, y, row[3], 13);
    k.rect(`st_row_status_${i}`, cx + 580, y - 5, 92, 24, row[4] === "Refunded" ? "danger" : "success");
    k.text(`st_row_status_t_${i}`, cx + 594, y, row[4], 11, "surface");
    k.text(`st_row_dl_${i}`, cx + 760, y, "Download", 11, "accent");
    k.line(`st_row_rule_${i}`, cx, y + 28, cx + 856, y + 28);
  });
  k.text("st_pager", cx, oy + 700, "Showing 5 of 24 invoices", 11, "muted");
  k.text("st_pager_next", cx + 780, oy + 700, "Next  →", 11);

  // Floating confirm modal — hi-fi surfaces need overlay depth.
  const mx = ox + 380;
  const my = oy + 236;
  k.rect("st_modal", mx, my, 400, 220, "surface");
  k.text("st_modal_title", mx + 24, my + 26, "Downgrade to Team?", 22);
  k.text("st_modal_body", mx + 24, my + 70, "You'll lose 8 seats and workspace memory", 13, "muted");
  k.text("st_modal_body2", mx + 24, my + 94, "on Sep 1. This cannot be undone.", 13, "muted");
  k.line("st_modal_rule", mx, my + 150, mx + 400, my + 150);
  k.rect("st_modal_cancel", mx + 168, my + 168, 92, 34, "surface");
  k.text("st_modal_cancel_t", mx + 190, my + 177, "Cancel", 11);
  k.rect("st_modal_ok", mx + 274, my + 168, 106, 34, "danger");
  k.text("st_modal_ok_t", mx + 292, my + 177, "Downgrade", 11, "surface");
  return k.out;
};

export type Blueprint = {
  id: string;
  label: string;
  blurb: string;
  build: Builder;
};

export const BLUEPRINTS: Blueprint[] = [
  {
    id: "dashboard",
    label: "Command center",
    blurb: "Dense app shell: nav, metrics, data table, live activity rail.",
    build: (x, y) => createProductionWireframe("project command center", x, y),
  },
  {
    id: "commerce",
    label: "Order ops",
    blurb: "Commerce back office with revenue metrics and order table.",
    build: (x, y) => createProductionWireframe("shop checkout order operations", x, y),
  },
  {
    id: "editor",
    label: "Workflow editor",
    blurb: "Canvas-style editor shell with components and runs.",
    build: (x, y) => createProductionWireframe("canvas node workflow editor", x, y),
  },
  { id: "mobile", label: "Mobile app", blurb: "Three device screens: feed, session detail, profile.", build: mobileApp },
  { id: "settings", label: "Billing settings", blurb: "Settings shell, invoice table, and a confirm modal.", build: settingsBilling },
];
