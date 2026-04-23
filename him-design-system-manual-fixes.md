# H.I.M. — Design System Manual Fixes
**The three remaining blockers, with exact instructions**

---

## How to Use This

1. Run the audit first: `bash him-design-system-fix.sh` (no flag — just prints, doesn't change anything)
2. Review the output to confirm which files are affected
3. Run `bash him-design-system-fix.sh --apply` to auto-patch bg-* overrides
4. Apply the two manual fixes below (chat input and tab bar)
5. `git diff` to verify, then commit

---

## Blocker 1 — Background Renders Black

**Root cause:** Tailwind utility classes in component JSX (`bg-black`, `bg-slate-950`, etc.) have higher specificity than `globals.css` CSS custom properties, so they override the `#13100E` base.

**Auto-fix:** The shell script handles this. It replaces:
- `bg-black` → `bg-[#13100E]`
- `bg-slate-950`, `bg-slate-900` → `bg-[#13100E]`
- `bg-slate-800` → `bg-[#1E1812]` (surface/card level)
- `bg-zinc-950`, `bg-zinc-900` → `bg-[#13100E]`
- `bg-gray-950`, `bg-gray-900` → `bg-[#13100E]`
- `bg-neutral-950`, `bg-neutral-900` → `bg-[#13100E]`

**After applying:** If anything still renders black, search for:
```
grep -rn "bg-\[#0" src/
grep -rn "background.*#000" src/
grep -rn "background.*black" src/
```

---

## Blocker 2 — Chat Input Dark Blue

**Root cause:** The chat input field has a hardcoded Tailwind blue or slate class overriding the design system.

**Find it:**
```bash
grep -rn "bg-blue-\|bg-indigo-\|bg-sky-\|bg-slate-7" src/ --include="*.tsx" --include="*.jsx"
```

Also search for "input" and "textarea" in context:
```bash
grep -rn "input\|textarea\|message.*input\|chat.*input" src/ --include="*.tsx" --include="*.jsx" -l
```

**Fix — replace the input field's className:**

| Old class | Replace with |
|---|---|
| `bg-blue-900` | `bg-[#1E1812]` |
| `bg-blue-950` | `bg-[#1E1812]` |
| `bg-indigo-900` | `bg-[#1E1812]` |
| `bg-slate-700` | `bg-[#1E1812]` |
| `bg-slate-750` | `bg-[#1E1812]` |
| Any other dark blue | `bg-[#1E1812]` |

**Full input element target classes:**
```tsx
// Replace whatever is there with:
className="bg-[#1E1812] border border-[#2A221A] text-white placeholder-[#6B5B4E] rounded-lg px-4 py-3 w-full focus:outline-none focus:border-[#E8608A] transition-colors"
```

**Input send button (if applicable):**
```tsx
// Active/hover:
className="text-[#E8608A] hover:text-[#D4963A] transition-colors"
```

---

## Blocker 3 — Tab Bar Active Pill

**Root cause:** The active tab has a background pill/badge that shouldn't be there. The active state should be color-only (rose `#E8608A` on icon and label), no background element.

**Find the tab bar component:**
```bash
grep -rn "tab\|TabBar\|BottomNav\|navigation" src/ --include="*.tsx" --include="*.jsx" -l
```

**What to look for:**
```tsx
// Pattern — any active state that has a bg- class
// Examples of what to remove:
className={`... ${isActive ? 'bg-rose-500/20 rounded-full' : ''} ...`}
className={`... ${isActive ? 'bg-[#E8608A]/10 rounded-full px-3' : ''} ...`}
```

**What the active tab should look like:**
```tsx
// CORRECT: color only, no bg
const tabClass = isActive
  ? "text-[#E8608A] flex flex-col items-center gap-1"
  : "text-[#4A3C35] flex flex-col items-center gap-1"

// Icon: inherits text color via currentColor
// Label: inherits text color
// NO background, NO rounded-full container, NO pill
```

**If using a separate active indicator element (a dot, underline, or badge) — remove it entirely.** The rose color is the only active indicator.

---

## Verification Checklist

After applying all fixes:

- [ ] Open app in browser/Xcode simulator
- [ ] Background renders `#13100E` (dark warm charcoal) — not black, not navy
- [ ] Chat input field background matches the surface color (`#1E1812`)
- [ ] Chat input placeholder text is visible but muted (`#6B5B4E`)
- [ ] Chat input border is subtle (`#2A221A`), turns rose on focus
- [ ] Active tab: only rose icon + rose label, no pill or background
- [ ] Inactive tabs: muted brown-gray, correct `#4A3C35`
- [ ] Online status dot still green `#4EC97A`
- [ ] Screennames still IBM Plex Mono
- [ ] Header gradient still present (rose → lavender → gold, 2px)

---

## Design Token Quick Reference

```
Base background:       #13100E
Surface / cards:       #1E1812
Surface border:        #2A221A
Rose primary:          #E8608A
Gold warmth:           #D4963A
Lavender idle:         #A78BFA
Green online:          #4EC97A
Text primary:          #F5EDE0
Text muted:            #6B5B4E
Text inactive nav:     #4A3C35
```

---

*H.I.M. Design System Fix Guide | Saman Technologies*
