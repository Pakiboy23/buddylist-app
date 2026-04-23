# H.I.M. Editorial Design Pass

All blue color violations replaced with H.I.M. brand colors. Apply these exact string replacements in each file.

---

## 1. `src/components/GroupChatWindow.tsx`

### Line ~1162 — Toolbar button active state
```diff
- bg-blue-50
+ bg-[#E8608A]/10

- bg-blue-500/15
+ bg-[#E8608A]/15
```

### Line ~1610 — Sent message bubble (isMine=true)
```diff
- bg-blue-500
+ bg-[#E8608A]/22
```
> Sent messages get a subtle rose-tinted surface, not full rose. Keeps legibility on dark bg.

### Line ~1643 — Save/confirm edit button
```diff
- bg-blue-500
+ bg-[#E8608A]

- hover:bg-blue-600
+ hover:bg-[#B93A67]
```

### Line ~1793 — Outbox/sending message bubble
```diff
- bg-blue-500/92
+ bg-[#E8608A]/75
```

---

## 2. `src/components/RichTextToolbar.tsx`

### Line ~71 — Active font selector button
```diff
- bg-blue-500
+ bg-[#A78BFA]
```
> Lavender for formatting/toolbar active state — keeps it distinct from rose (which is primary action).

---

## 3. `src/components/IncomingMessageBanner.tsx`

### Line ~111 — DM notification avatar (light + dark variants)
```diff
- bg-blue-50
+ bg-[#E8608A]/10

- bg-blue-500/15
+ bg-[#E8608A]/15
```

---

## 4. `src/components/MessageReactions.tsx`

### Line ~41 — Reaction picker active emoji
```diff
- bg-blue-50
+ bg-[#E8608A]/10

- bg-blue-500/15
+ bg-[#E8608A]/15
```

### Line ~81 — Reaction strip (user reacted)
```diff
- bg-blue-50/95
+ bg-[#E8608A]/10

- bg-blue-500/18
+ bg-[#E8608A]/18
```

---

## 5. `src/components/ChatWindow.tsx`

Apply these across the file (use find/replace):
```diff
- bg-blue-500
+ bg-[#E8608A]

- hover:bg-blue-600
+ hover:bg-[#B93A67]

- bg-blue-50
+ bg-[#E8608A]/10

- dark:bg-blue-500/15
+ dark:bg-[#E8608A]/15
```

---

## 6. `src/components/ChatMediaGallerySheet.tsx`

```diff
- bg-blue-500
+ bg-[#E8608A]

- bg-blue-50
+ bg-[#302820]
```
> Use `bg-[#302820]` (bg4) for icon background placeholders — warm charcoal surface, not rose tint.

---

## 7. `src/components/SavedMessagesWindow.tsx`

### Line ~86 — Saved messages icon background
```diff
- bg-blue-50
+ bg-[#302820]
```

---

## 8. `src/app/hi-its-me/page.tsx`

### Line ~6519 — Sync status indicator
```diff
- bg-sky-400
+ bg-[#D4963A]
```
> Gold for sync/status indicators — communicates "in progress" rather than "action."

---

## globals.css additions

Add these two classes to the `.ui-wordmark` section (around line 1580), after the existing `.ui-wordmark` block:

```css
/* H.I.M. wordmark letter + pip treatment */
.him-letter {
  background: linear-gradient(135deg, var(--rose) 0%, var(--gold) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
}

.him-pip {
  display: inline-block;
  width: 0.3em;
  height: 0.3em;
  border-radius: 50%;
  vertical-align: middle;
  margin-bottom: 0.08em;
  flex-shrink: 0;
}
```
