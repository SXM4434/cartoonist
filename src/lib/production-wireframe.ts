import type { IconKind, SketchPrimitive } from "./sketch-types";

const ui = <T extends SketchPrimitive>(shape: T): T => ({ ...shape, style: "ui" });

/**
 * Immediate, deterministic production shell. The AI remains responsible for
 * interpreting the product and enriching it, but users never wait on hundreds
 * of generated coordinates before seeing a credible high-fidelity screen.
 */
export function createProductionWireframe(prompt: string, originX = 80, originY = 80): SketchPrimitive[] {
  const p = prompt.toLowerCase();
  const isEditor = /canvas|node|editor|workflow/.test(p);
  const isCommerce = /shop|commerce|checkout|store|order/.test(p);
  const product = isEditor ? "Orbit Studio" : isCommerce ? "North Store" : "Atlas Work";
  const title = isEditor ? "Workflow editor" : isCommerce ? "Order operations" : "Project command center";
  const nav = isEditor ? ["Workspace", "Components", "Runs", "Assets", "Settings"] : isCommerce ? ["Overview", "Orders", "Products", "Customers", "Analytics"] : ["Overview", "My tasks", "Projects", "Calendar", "Reports"];
  const rows = isCommerce
    ? [["#1048", "Maya Chen", "Processing", "$248.00"], ["#1047", "Theo Grant", "Shipped", "$96.50"], ["#1046", "Amara Cole", "Review", "$412.00"], ["#1045", "Jon Bell", "Delivered", "$72.00"]]
    : [["Design QA", "Maya Chen", "In review", "Aug 14"], ["API handoff", "Theo Grant", "In progress", "Aug 16"], ["Research synthesis", "Amara Cole", "Blocked", "Aug 18"], ["Launch checklist", "Jon Bell", "Ready", "Aug 20"]];
  const s: SketchPrimitive[] = [];
  const add = (shape: SketchPrimitive) => s.push(ui(shape));
  const rect = (id: string, x: number, y: number, w: number, h: number, tone: SketchPrimitive["tone"] = "surface", fill = "solid") => add({ type: "rect", id, x, y, w, h, tone, fill });
  const text = (id: string, x: number, y: number, value: string, size = 13, tone: SketchPrimitive["tone"] = "ink") => add({ type: "text", id, x, y, text: value, size, tone });
  const line = (id: string, x1: number, y1: number, x2: number, y2: number) => add({ type: "line", id, x1, y1, x2, y2, tone: "muted" });
  const icon = (id: string, kind: IconKind, x: number, y: number, size = 14) => add({ type: "icon", id, kind, x, y, size, tone: "muted" });

  rect("prod_frame", originX, originY, 1120, 720);
  rect("prod_topbar", originX, originY, 1120, 48, "surface");
  line("prod_top_rule", originX, originY + 48, originX + 1120, originY + 48);
  text("prod_brand", originX + 20, originY + 14, product, 15);
  rect("prod_search", originX + 330, originY + 9, 330, 30, "subtle");
  icon("prod_search_icon", "search", originX + 342, originY + 17, 14);
  text("prod_search_text", originX + 366, originY + 16, "Search or jump to…", 11, "muted");
  rect("prod_create", originX + 916, originY + 9, 112, 30, "accent");
  text("prod_create_text", originX + 935, originY + 16, isEditor ? "Run workflow" : isCommerce ? "New order" : "Create task", 11, "surface");
  icon("prod_bell", "warning", originX + 1050, originY + 16, 14);
  add({ type: "ellipse", id: "prod_avatar", x: originX + 1080, y: originY + 11, w: 26, h: 26, tone: "accent", fill: "solid" });

  rect("prod_sidebar", originX, originY + 49, 176, 671, "subtle");
  text("prod_nav_label", originX + 18, originY + 72, "WORKSPACE", 11, "muted");
  nav.forEach((label, i) => {
    const y = originY + 96 + i * 42;
    if (i === 0) rect(`prod_nav_bg_${i}`, originX + 10, y - 7, 156, 32, "surface");
    if (i === 0) rect("prod_nav_active", originX + 10, y - 7, 3, 32, "accent");
    icon(`prod_nav_icon_${i}`, (["house", "check", "folder", "calendar", "chart"][i] ?? "doc") as IconKind, originX + 24, y, 14);
    text(`prod_nav_text_${i}`, originX + 49, y - 1, label, 13, i === 0 ? "ink" : "muted");
  });
  line("prod_sidebar_rule", originX + 176, originY + 49, originX + 176, originY + 720);
  text("prod_team_label", originX + 18, originY + 650, "TEAM SPACE", 11, "muted");
  add({ type: "ellipse", id: "prod_team_avatar", x: originX + 18, y: originY + 676, w: 24, h: 24, tone: "success", fill: "solid" });
  text("prod_team_name", originX + 52, originY + 678, "Product team", 13);

  const cx = originX + 208;
  text("prod_crumb", cx, originY + 74, "Workspace  /  Product", 11, "muted");
  text("prod_title", cx, originY + 104, title, 22);
  text("prod_subtitle", cx, originY + 136, isEditor ? "Build, test, and publish automations" : "Track priorities, owners, and delivery health", 13, "muted");
  rect("prod_more", originX + 1030, originY + 102, 66, 28, "surface");
  text("prod_more_text", originX + 1045, originY + 108, "•••", 13, "muted");

  const metrics = isCommerce ? [["Revenue", "$42.8k", "+12.4%"], ["Orders", "1,284", "+8.1%"], ["AOV", "$96.40", "+2.8%"]] : [["Active work", "24", "+4 this week"], ["On track", "82%", "+6.2%"], ["Team capacity", "68%", "12 available"]];
  metrics.forEach((m, i) => {
    const x = cx + i * 218;
    rect(`prod_metric_${i}`, x, originY + 174, 202, 100, i === 1 ? "subtle" : "surface");
    text(`prod_metric_label_${i}`, x + 16, originY + 190, m[0], 11, "muted");
    text(`prod_metric_value_${i}`, x + 16, originY + 218, m[1], 22);
    text(`prod_metric_delta_${i}`, x + 16, originY + 248, m[2], 11, "success");
    line(`prod_metric_spark_${i}`, x + 124, originY + 238, x + 182, originY + 212 + i * 5);
  });

  rect("prod_table", cx, originY + 300, 652, 350, "surface");
  text("prod_table_title", cx + 16, originY + 318, isCommerce ? "Recent orders" : "Priority work", 15);
  text("prod_table_count", cx + 16, originY + 344, `${rows.length} items`, 11, "muted");
  ["All", "Active", "Review", "Done"].forEach((tab, i) => {
    text(`prod_tab_${i}`, cx + 310 + i * 76, originY + 325, tab, 11, i === 0 ? "ink" : "muted");
    if (i === 0) rect("prod_tab_active", cx + 306, originY + 346, 34, 2, "accent");
  });
  line("prod_table_header_rule", cx, originY + 360, cx + 652, originY + 360);
  ["TASK", "OWNER", "STATUS", "DUE"].forEach((h, i) => text(`prod_th_${i}`, cx + [16, 278, 402, 535][i], originY + 374, h, 11, "muted"));
  rows.forEach((row, i) => {
    const y = originY + 404 + i * 54;
    if (i === 1) rect(`prod_row_hover_${i}`, cx + 1, y - 12, 650, 53, "subtle");
    add({ type: "rect", id: `prod_check_${i}`, x: cx + 16, y: y, w: 14, h: 14, tone: i === 3 ? "accent" : "surface", fill: i === 3 ? "solid" : undefined });
    text(`prod_row_task_${i}`, cx + 42, y - 1, row[0], 13);
    add({ type: "ellipse", id: `prod_row_avatar_${i}`, x: cx + 278, y: y - 4, w: 22, h: 22, tone: i % 2 ? "accent" : "muted", fill: "solid" });
    text(`prod_row_owner_${i}`, cx + 309, y - 1, row[1], 11);
    rect(`prod_status_${i}`, cx + 402, y - 5, 88, 24, i === 2 ? "danger" : i === 3 ? "success" : "subtle");
    text(`prod_status_text_${i}`, cx + 414, y, row[2], 11, i === 2 ? "surface" : "ink");
    text(`prod_due_${i}`, cx + 535, y - 1, row[3], 11, "muted");
    text(`prod_action_${i}`, cx + 624, y - 1, "•••", 11, "muted");
    line(`prod_row_rule_${i}`, cx + 16, y + 32, cx + 636, y + 32);
  });

  rect("prod_activity", originX + 884, originY + 174, 212, 476, "surface");
  text("prod_activity_title", originX + 900, originY + 192, "Activity", 15);
  text("prod_activity_live", originX + 1024, originY + 194, "LIVE", 11, "success");
  line("prod_activity_rule", originX + 884, originY + 224, originX + 1096, originY + 224);
  ["Maya moved Design QA", "Theo attached API notes", "Amara flagged a blocker", "Jon completed review"].forEach((v, i) => {
    const y = originY + 252 + i * 82;
    add({ type: "ellipse", id: `prod_activity_avatar_${i}`, x: originX + 900, y, w: 26, h: 26, tone: i === 2 ? "danger" : "muted", fill: "solid" });
    text(`prod_activity_text_${i}`, originX + 938, y - 1, v, 11);
    text(`prod_activity_time_${i}`, originX + 938, y + 20, `${i + 2} min ago`, 11, "muted");
    if (i < 3) line(`prod_activity_line_${i}`, originX + 913, y + 30, originX + 913, y + 72);
  });
  rect("prod_activity_button", originX + 900, originY + 606, 180, 28, "surface");
  text("prod_activity_button_text", originX + 946, originY + 612, "View all activity", 11);
  rect("prod_scroll", originX + 1086, originY + 236, 4, 396, "subtle");
  rect("prod_scroll_thumb", originX + 1086, originY + 238, 4, 104, "muted");
  text("prod_statusbar", originX + 192, originY + 690, "Synced just now  •  4 collaborators online", 11, "muted");
  text("prod_shortcut", originX + 1020, originY + 690, "⌘ K  Search", 11, "muted");
  return s;
}