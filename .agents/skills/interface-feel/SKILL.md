---
name: interface-feel
description: "Design engineering principles distilled from Jakub Krehel's writings (jakub.kr). Embeds his teaching style and voice. Use when implementing animations, building UI interactions, working with gradients/colors, reviewing interface quality, or explaining motion/CSS concepts. Triggers on: animation, motion, framer-motion, gesture, drag, transition, gradient, OKLCH, will-change, layout animation, interface polish, UI details, microinteractions."
---

# Interface Feel
*Distilled from Jakub Krehel's writings — jakub.kr*

---

## How to Teach With This Skill

When this skill is active, adopt Jakub's teaching voice and method. His style is distinct:

**Show the problem first.** Don't start with the solution. Show what breaks, what looks off, what feels wrong — then explain why, then fix it.

**Before / After is the core unit.** Almost every concept he teaches is shown as a contrast. "Without this, you get X. With it, you get Y." Always make the difference visible.

**Build up layer by layer.** Start simple. Establish the base concept, then add complexity. Never explain a dependency before the thing that needs it.

**Lead with a demo, follow with code.** The interactive example comes first. The code snippet is the explanation of the demo, not the other way around.

**Be honest about tradeoffs.** Every technique has a cost. Don't oversell. "This can be a double-edged sword." "Keep in mind that..."

**Short sentences. No filler.** Jakub writes like he codes — no dead weight. Each sentence does one job.

**Use "I" sparingly but personally.** He shares when he discovered something or changed his mind. "I realized I never understood exactly what it does." "I've been using this for a while but..."

**Acknowledge edge cases.** He names the browsers that struggle, the fonts that behave differently, the scenarios where the technique breaks. Real-world honesty.

**End with an invitation.** He doesn't close with authority. He closes with curiosity — "if you have any examples, shoot me an email."

### Signature phrases (use these naturally):
- "The great part about [X] is..."
- "Keep in mind that..."
- "This is one of the more important concepts that often goes unnoticed."
- "This can be a double-edged sword."
- "I'd recommend..."
- "In most cases..." / "In practice..."
- "The difference is only noticeable in [context]"
- "It's a hint to the browser, something along the lines of..."
- "X is pretty powerful... however, it's not [magic/free/a fix for Y]"

---

## The Knowledge

### 1. Details That Make Interfaces Feel Better
*https://jakub.kr/writing/details-that-make-interfaces-feel-better*

> Great interfaces rarely come from a single thing. It's usually a collection of small things that compound into a great experience.

---

#### text-wrap: balance
A quick way to improve how text behaves is `text-wrap: balance`. It distributes text evenly across each line, avoiding orphaned words.

```
wrap:    "Designing interfaces that feel
          natural and intuitive Great
          design is invisible."

balance: "Designing interfaces that feel
          natural and intuitive. Great
          design is invisible."
```

```css
p { text-wrap: balance; }
```

You can also use `text-wrap: pretty` for a similar result — it's a bit slower because it uses a different algorithm.

---

#### Concentric Border Radius
This is one of the more important concepts that make interfaces feel great and it often goes unnoticed.

The formula is simple: **outer radius = inner radius + padding.**

```
padding: 8px
inner:   12px
outer:   20px  ← 12 + 8
```

```css
.outer { border-radius: 20px; padding: 8px; }
.inner { border-radius: 12px; }
```

There's still a surprising number of apps that don't do this and instead mismatch border radii. If you're not already doing this, I'd recommend starting. It will make your interfaces feel much better.

---

#### Icon Transitions
Animating opacity, scale and blur on icons when they swap contextually makes the transition feel more responsive.

```tsx
<motion.div
  key={isCopied ? "check" : "copy"}
  initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
  exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
  transition={{ type: "spring", duration: 0.3, bounce: 0 }}
>
  {isCopied ? <CheckIcon /> : <CopyIcon />}
</motion.div>
```

You can achieve the same effect with CSS only. I personally prefer Motion because it allows me to use spring animations easily.

---

#### Font Smoothing
On macOS, text rendering can sometimes appear heavier than intended. Setting `-webkit-font-smoothing: antialiased` makes text render slightly thinner and crisper.

The best way to apply this is to add it to the entire layout. That way it applies to all text elements in your app.

```html
<body class="font-sans antialiased">
```

---

#### Tabular Numbers
If your numbers shift when they update, use `font-variant-numeric: tabular-nums`. It makes the digits equal width.

```css
.number { font-variant-numeric: tabular-nums; }
/* Tailwind: tabular-nums */
```

Keep in mind that some fonts — such as Inter — change the look of numerals when this property is used.

---

#### CSS Transitions vs Keyframe Animations
When it comes to interruptibility, these behave differently:

- **Transitions** interpolate toward the latest state and can be interrupted.
- **Keyframe animations** run on a fixed timeline and don't retarget after they start.

Users often change their intent mid-interaction. If animations aren't interruptible, the interface can feel broken. On iOS, interruptibility is quite prevalent for this very reason.

**A rule of thumb:** CSS transitions are great for interactions, while keyframe animations are better for staged sequences that run once.

---

#### Staggered Enter Animations
Enter animations often combine opacity, blur and translateY. It helps to break components into smaller chunks and animate them individually instead of animating a big block at once.

```css
@keyframes enter {
  from { transform: translateY(8px); filter: blur(5px); opacity: 0; }
}
.animate-enter {
  animation: enter 800ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  animation-delay: calc(var(--delay, 0ms) * var(--stagger, 0));
  /* --delay: 80ms for word-level, 100ms for block-level */
}
```

```tsx
<div className="animate-enter" style={{ "--stagger": 1 }}><Title /></div>
<div className="animate-enter" style={{ "--stagger": 2 }}><Description /></div>
<div className="animate-enter" style={{ "--stagger": 3 }}><Buttons /></div>
```

---

#### Exit Animations
Exit animations usually work better when they're more subtle than enter animations.

Exiting elements don't need the same amount of movement and attention as entering elements.

```tsx
// Enter: full distance — demands attention
initial={{ opacity: 0, y: "calc(-100% - 4px)", filter: "blur(4px)" }}

// Exit: subtle fixed value — soft, doesn't demand attention
exit={{ opacity: 0, y: "-12px", filter: "blur(4px)" }}
transition={{ type: "spring", duration: 0.45, bounce: 0 }}
```

I wouldn't recommend removing the animation completely — some subtle motion should remain to indicate direction.

---

#### Optical Alignment
Aligning items geometrically works great most of the time, but there are instances where it just looks off. When that happens, align items optically instead.

For example, when a button has both text and an icon, it is better to have a slightly smaller padding on the side of the icon to optically align the content.

For icons, the best way to fix it is in the SVG itself, so no additional margin or padding needs to be added.

---

#### Box Shadow Instead of Borders
Instead of borders, I often prefer to use a subtle box-shadow that adds more depth to the element.

```css
.card {
  box-shadow:
    0px 0px 0px 1px rgba(0, 0, 0, 0.06),
    0px 1px 2px -1px rgba(0, 0, 0, 0.06),
    0px 2px 4px 0px rgba(0, 0, 0, 0.04);
}
/* Hover: same values, slightly darker opacity */
/* Transition: add transition-[box-shadow] */
```

It also helps when using images or multiple colors as backgrounds. Shadows are versatile and adapt well to any background since they use transparency. Solid colors don't.

---

#### Image Border Overlay
A visual tweak I use a lot is adding a 1px black or white outline with 10% opacity to images. This creates a sense of depth and a somewhat consistent outline around the element.

```css
.image {
  outline: 1px solid rgba(0, 0, 0, 0.1);
  outline-offset: -1px;
}
.dark .image { outline-color: rgba(255, 255, 255, 0.1); }
```

---

### 2. Using Gestures in Motion
*https://jakub.kr/work/motion-gestures*

> Gestures are what makes elements feel alive. The user performs an action and the interface responds appropriately.

Motion extends React's basic event system with gestures: `whileHover`, `whileTap`, `onPan`, `whileDrag`, `whileFocus`, `whileInView`.

Each can trigger animations through a `while-` prop or be handled with event listeners. `pan` is the exception — no `while-` prop.

---

#### Hover
The great part about Motion is that you can easily use spring animations, which is pretty difficult to do with CSS.

```tsx
<motion.div
  whileHover={{ rotate: 180 }}
  transition={{ type: "spring", duration: 0.8, bounce: 0 }}
/>
```

For effects involving `transform`, `clipPath` or `filter`, CSS and Motion behave almost identically in terms of performance — both run on the compositor thread. Sometimes Motion's performance is even better because it handles independent transforms more efficiently.

---

#### Tap
`whileTap` fires when a pointer presses and releases on the same element. It automatically cancels if the pointer moves too far, so it won't conflict with drags.

```tsx
<motion.div
  whileTap={{ scale: 0.8 }}
  transition={{ type: "spring", duration: 0.5, bounce: 0 }}
/>
```

It's also keyboard accessible. Pressing the return key triggers `onTapStart` and `whileTap`. Releasing fires `onTap`.

---

#### Drag
To make a component draggable, add the `drag` prop. `dragConstraints` prevents it from leaving its container.

```tsx
<motion.div
  drag
  dragConstraints={constraintsRef}
  whileDrag={{ scale: 0.8 }}
  transition={{ type: "spring", duration: 0.5, bounce: 0 }}
/>
```

---

#### Pan
Pan recognizes when a pointer moves more than 3px while pressed. It doesn't have a `while-` prop — use event handlers.

```tsx
<motion.div
  onPanStart={() => setIsPanning(true)}
  onPanEnd={() => setIsPanning(false)}
  animate={{ scale: isPanning ? 0.9 : 1 }}
/>
```

Great for sliders and scrollable areas. Use springs — they make the motion feel more natural and realistic.

---

#### Focus
`whileFocus` fires when an element gains or loses focus, following the same logic as `:focus-visible` in CSS.

```tsx
<motion.button
  whileFocus={{ scale: 1.1 }}
  transition={{ type: "spring", duration: 0.3, bounce: 0 }}
/>
```

I'd recommend keeping focus animations subtle. Overly complex motion can feel distracting or disorienting when navigating by keyboard.

---

#### InView
`whileInView` triggers when an element enters or exits the viewport. Pair it with `initial` to define the starting state.

```tsx
<motion.div
  initial={{ opacity: 0, filter: "blur(8px)" }}
  whileInView={{ opacity: 1, filter: "blur(0px)" }}
  viewport={{ amount: 0.5 }}
  transition={{ type: "spring", duration: 0.6, bounce: 0 }}
/>
```

---

### 3. Drag Gestures on the Web
*https://jakub.kr/work/drag-gesture*

> Drag gestures are far less common on the web than on mobile. They can feel great — if you get the details right.

The key insight: **`dragMomentum={false}`** is what makes swipe gestures feel intentional. Without it, the row overshoots based on velocity. With it, the row stops exactly where you decide.

```tsx
const x = useMotionValue(0);

<motion.div
  drag="x"
  dragConstraints={{ left: SNAP_POINTS.LEFT, right: SNAP_POINTS.RIGHT }}
  dragElastic={0.05}     // very little overshoot
  dragMomentum={false}   // row stops where you release, not where velocity carries it
  style={{ x }}
/>
```

**Snap points:**
```tsx
const SNAP_POINTS = { LEFT: -116, CENTER: 0, RIGHT: 116 };
const POSITION_THRESHOLD = 58; // commit point — past this, snap; before this, return

const handleDragEnd = () => {
  const currentX = x.get();
  animate(x,
    Math.abs(currentX) > POSITION_THRESHOLD
      ? (currentX > 0 ? SNAP_POINTS.RIGHT : SNAP_POINTS.LEFT)
      : SNAP_POINTS.CENTER,
    SPRING_CONFIG
  );
};
```

**Progressive reveal** — the original iOS gesture doesn't reveal all actions at once:
```tsx
const [dragProgress, setDragProgress] = useState(0);
useEffect(() => x.on("change", setDragProgress), [x]);

<ActionButton isVisible={dragProgress > 44} />  // first action at 44px
<ActionButton isVisible={dragProgress > 88} />  // second action at 88px

// Each button:
<motion.button
  animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.5 }}
  initial={{ opacity: 0, scale: 0.5 }}
/>
```

I like to keep threshold values in pixels so I can easily tweak them.

---

### 4. Using AI as a Design Engineer
*https://jakub.kr/work/using-ai-as-a-design-engineer*

> There is an important distinction to make here. I don't use AI to come up with ideas or to replace my own thinking. I use it to accelerate my workflow.

**The core principle:** AI works best if the user is in charge. Don't just blindly follow whatever the agent gives you. It's also very important to understand what the agent is doing.

---

#### Rules Files
The first thing I do when starting a project is create a set of rules for the codebase. Keep rules short and to the point, often referencing other files.

Categories I use:
- `animation-performance.mdc` — will-change usage, transform/opacity only
- `cn-util.mdc` — use `cn()` not template literals
- `design-system.mdc` — component usage patterns
- `animation-rules.mdc` — spring configs, timing standards

Copying someone else's rules without understanding them isn't great. If you're going to copy rules, understand what they actually do first.

---

#### /deslop Command
```
Check diff against main. Remove all AI-generated slop introduced in this branch:
- Extra comments a human wouldn't add
- Defensive try/catch blocks abnormal for this codebase
- Casts to any to get around type issues
- Style inconsistent with the file

Report with only a 1-3 sentence summary of what you changed.
```

---

#### Prompt Structure
```
❌  Do this, do this too, oh and this, I forgot this, and this doesn't work

✅  Do task 1.
    [wait]
    Do task 2.
```

Structuring prompts into smaller sequential ones makes the output much better and easier to follow.

---

#### Workflow Notes
- Use **Plan mode** before bigger features — the difference is significant
- **Figma MCP** for UI scaffolding — output is surprisingly good with well-set-up rules
- **context7 MCP** for up-to-date library docs (LLM training data is often stale)
- CLIs (Claude Code, Codex) are better than IDEs for bigger tasks
- Codex on every PR for automated code review

---

#### On Writing Less Code
Sometimes you write the same code multiple times and it's difficult to track. AI is great at finding duplications and extracting them into shared components/utilities.

These are the kind of tasks I like using AI for the most — not generating ideas, but eliminating tedium.

---

### 5. will-change in CSS
*https://jakub.kr/components/will-change-in-css*

> It's a hint to the browser, something along the lines of: "hey, I'm about to animate these properties, please get ready."

---

**How browsers render:**
1. **Layout** (CPU) — figure out box sizes and positions
2. **Paint** (CPU) — fill pixels, colors, borders, shadows
3. **Composite** (GPU) — stack layers, display on screen

If an animation touches only `transform` and `opacity`, the browser can skip layout and paint entirely — the GPU handles everything.

**Without `will-change`:** layer promotion happens when the animation starts → tiny stutter on frame 1.

**With `will-change`:** the browser pre-promotes the element when the page is idle → smooth from the first frame.

```css
/* Good — specific, intentional */
.animated-button {
  will-change: transform, opacity;
}

/* Bad — wastes memory, no real gain */
* { will-change: auto; }
.button { will-change: all; }
```

**Properties worth using it on:**
- `transform`, `opacity`, `filter` — GPU compositing, skip layout + paint
- `clip-path`, `mask` — modern browsers handle well
- `scroll-position` — for parallax/scroll animations
- `contents` — for virtual lists and frequently updating containers

Other properties like `top`, `background`, `border` are legal to write — but they don't actually speed anything up, they just ask the browser to reserve memory for no real gain.

`will-change` is not a magic performance switch. Modern browsers are already very good at optimizing on their own. Use it thoughtfully and sparingly — only on elements that will actually animate.

---

### 6. Shared Layout Animations
*https://jakub.kr/work/shared-layout-animations*

> Shared layout animations allow you to animate between different elements with a single line of code.

They use the [FLIP technique](https://css-tricks.com/animating-layouts-with-the-flip-technique/) under the hood — First, Last, Inverse, Play.

```tsx
// Same layoutId = Motion animates between them automatically
// You're not moving a component — you're rendering different ones with the same id

case "Design":
  return <motion.div layoutId="circle" className="size-16 rounded-full" />;
case "Engineering":
  return <motion.div layoutId="circle" className="absolute top-4 right-4 size-16 rounded-full" />;
```

As long as the `layoutId` is unique to the group, the animation works correctly between as many elements as you want.

---

**AnimatePresence gotcha:** keep `layoutId` elements **outside** of `<AnimatePresence>`.

If they're inside, the initial and exit animations trigger while the layout animation is running — which doesn't look great, especially when animating `opacity`.

```tsx
// ✅ Correct pattern
<motion.div layoutId="card" transition={{ type: "spring", duration: 0.55, bounce: 0.1 }} />
<AnimatePresence mode="popLayout">
  <motion.div
    key={activeTab}
    animate={{ opacity: 1, filter: "blur(0px)", scale: 1, y: 0 }}
    exit={{ opacity: 0, filter: "blur(4px)", scale: 0.95, y: 32 }}
    initial={{ opacity: 0, filter: "blur(4px)", scale: 0.95, y: 32 }}
    transition={{ type: "spring", duration: 0.55, bounce: 0 }}
  >
    {getContent()}
  </motion.div>
</AnimatePresence>
```

Works great paired with Radix Dialog — a card expands into a modal using a shared `layoutId`.

---

### 7. Understanding Gradients
*https://jakub.kr/work/gradients*

> We use gradients every day and they might seem fairly straightforward, but there's a surprising amount of complexity.

---

**Three types:**
```css
linear-gradient(to bottom, blue, red)
radial-gradient(circle, blue, red)
conic-gradient(from 90deg, blue, red)
```

---

**Linear — key controls:**
```css
linear-gradient(45deg, blue, red)                      /* direction */
linear-gradient(to bottom, blue 25%, red 75%)          /* stops */
linear-gradient(to bottom, blue 50%, red 50%)          /* sharp edge */
repeating-linear-gradient(45deg, blue 0 10px, red 10px 20px)
```

**Diamond gradient** (not a CSS type — four layered linears):
```css
background:
  linear-gradient(to bottom right, #fff 0%, #999 50%) bottom right / 50% 50% no-repeat,
  linear-gradient(to bottom left, #fff 0%, #999 50%) bottom left / 50% 50% no-repeat,
  linear-gradient(to top left, #fff 0%, #999 50%) top left / 50% 50% no-repeat,
  linear-gradient(to top right, #fff 0%, #999 50%) top right / 50% 50% no-repeat;
```

---

**Radial — key controls:**
```css
radial-gradient(circle, blue, red)                    /* circle | ellipse */
radial-gradient(circle closest-side, blue, red)       /* size keywords */
radial-gradient(circle at 70% 30%, blue, red)         /* position */
```

---

**Conic:**
```css
conic-gradient(from 90deg, blue, red)                 /* starting angle */
conic-gradient(at 70% 30%, blue, red)                 /* rotation center */
/* Great for charts, rings, animated borders */
```

---

**Color spaces — this is where it gets interesting:**
```css
linear-gradient(in oklch, blue, red)
```

All examples above use sRGB by default. But gradients behave very differently depending on color space:
- **sRGB** — straight-line interpolation, can produce muddy midpoints
- **oklab** — also straight-line, but perceptually consistent (Tailwind 4 default)
- **oklch** — interpolates in a circle (hue is angular), can introduce colors you never defined

This can be a double-edged sword. Some gradients look smoother in oklch. Others take unexpected detours through hues you didn't intend. Many tools use oklab for gradients instead, because it gives more consistent results.

---

**Color hints** — control where the midpoint appears, not a new color:
```css
linear-gradient(to right, red, 40%, blue)
/* red transitions faster, blue takes up more space */
```

---

**Animation performance:**
- Cheap: `background-position`, `background-size`, `opacity`
- Expensive: changing color stops, adding/removing layers, switching types

Better to animate a pseudo-element overlay, or use CSS variables for colors:
```css
/* Animate the variable, not the color stop directly */
```

---

**Layered gradients + blend modes:**
```css
.layered {
  background:
    linear-gradient(in oklch 135deg, oklch(0.75 0.18 280), oklch(0.8 0.15 80), oklch(0.75 0.18 320)),
    conic-gradient(in oklch from 180deg, oklch(0.7 0.12 200 / 0.3), oklch(0.7 0.12 340 / 0.3), oklch(0.7 0.12 200 / 0.3));
  background-blend-mode: overlay, color-dodge;
}
```

---

### 8. What Are OKLCH Colors?
*https://jakub.kr/components/oklch-colors*

> oklch is designed to be perceptually uniform. Colors are much more accurate in terms of how humans perceive them.

`oklch(lightness chroma hue)`

- **Lightness** — 0 to 1
- **Chroma** — color intensity (like saturation)
- **Hue** — 0 to 360 degrees

---

**The key advantage:** same lightness + chroma, different hue = visually uniform palette. You can't do this reliably in HSL.

```css
oklch(0.55 0.18 30)   /* orange */
oklch(0.55 0.18 130)  /* green  */
oklch(0.55 0.18 230)  /* blue   */
oklch(0.55 0.18 300)  /* purple */
/* All feel equally vivid and the same "weight" */
```

In HSL at the same saturation, some colors look lighter, some darker, some more saturated. oklch eliminates this.

---

**Shade generation:** oklch maintains consistent hue across the full lightness scale. HSL drifts — blues turn purple at the light end, gray at the dark end.

---

**Display P3:** oklch can reference colors outside sRGB — richer, more vivid on modern displays. If a display doesn't support P3, the browser maps the color back to the nearest sRGB equivalent.

---

**Browser support + fallbacks:**
```css
:root {
  --color-primary: #1E90FF; /* sRGB fallback */

  @supports (color: oklch(0 0 0)) {
    --color-primary: oklch(0.55 0.18 260);
  }
}
```

Keep in mind — if the oklch value fits inside the sRGB gamut anyway, it will look identical to the hex fallback.

---

**Tailwind 4** defaults to oklab for gradient interpolation — straight-line, no unexpected hue shifts.

**Tool:** [oklch.fyi](https://oklch.fyi) — palette generation, convert existing CSS variables to oklch.

---

## Quick Reference

| Topic | Rule |
|-------|------|
| Border radius | `outer = inner + padding` — always |
| Text wrap | `text-wrap: balance` on headings |
| Font smoothing | `antialiased` on body, always |
| Icon transitions | opacity + scale + blur, spring animation |
| Transitions vs keyframes | interactions = transitions, sequences = keyframes |
| Enter animations | stagger 80-100ms per element, not one block |
| Exit animations | subtle fixed value (-12px), not full distance |
| Box shadow | 3-layer stack — adapts to any background |
| Image borders | `outline: 1px solid rgba(0,0,0,0.1); outline-offset: -1px` |
| will-change | specific + sparingly — `transform, opacity` only |
| Drag gestures | `dragMomentum={false}` for snap points |
| Layout animations | `layoutId` outside `<AnimatePresence>` |
| Gradient color space | oklab for consistency, oklch for creative effects |
| OKLCH palettes | same L+C, vary hue = perceptually uniform |
