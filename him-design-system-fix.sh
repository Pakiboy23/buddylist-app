#!/bin/bash
# H.I.M. Design System Fix Script
# Run from the root of the buddylist-app repo
# Fixes: background color override, chat input, tab bar pill
#
# Usage: bash him-design-system-fix.sh
# Safe to run: prints diffs before making changes. Pass --apply to apply them.

APPLY=false
if [ "$1" == "--apply" ]; then
  APPLY=true
fi

SRC_DIR="./src"

echo "========================================"
echo "H.I.M. Design System Audit + Fix Script"
echo "========================================"
echo ""

# ─────────────────────────────────────────────
# PHASE 1: AUDIT — find all hardcoded bg overrides
# ─────────────────────────────────────────────
echo "PHASE 1: Auditing hardcoded background classes..."
echo ""

echo "--- Files with bg-black ---"
grep -rn "bg-black" $SRC_DIR --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js"

echo ""
echo "--- Files with bg-slate-* ---"
grep -rn "bg-slate-[0-9]*" $SRC_DIR --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js"

echo ""
echo "--- Files with bg-zinc-* ---"
grep -rn "bg-zinc-[0-9]*" $SRC_DIR --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js"

echo ""
echo "--- Files with bg-gray-* ---"
grep -rn "bg-gray-[0-9]*" $SRC_DIR --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js"

echo ""
echo "--- Files with bg-neutral-* ---"
grep -rn "bg-neutral-[0-9]*" $SRC_DIR --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js"

echo ""
echo "--- Files with bg-stone-* ---"
grep -rn "bg-stone-[0-9]*" $SRC_DIR --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js"

echo ""
echo "--- Files with bg-blue-* (chat input suspect) ---"
grep -rn "bg-blue-[0-9]*" $SRC_DIR --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js"

echo ""
echo "--- Files with bg-indigo-* ---"
grep -rn "bg-indigo-[0-9]*" $SRC_DIR --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js"

echo ""
echo "--- Tab bar / pill classes ---"
grep -rn "rounded-full\|active.*bg-\|pill\|tab.*bg-" $SRC_DIR --include="*.tsx" --include="*.jsx" -l

echo ""
echo "========================================"
echo "PHASE 1 COMPLETE. Review the above."
echo "If ready to apply fixes, run: bash him-design-system-fix.sh --apply"
echo "========================================"
echo ""

if [ "$APPLY" = false ]; then
  exit 0
fi

# ─────────────────────────────────────────────
# PHASE 2: APPLY FIXES
# ─────────────────────────────────────────────
echo ""
echo "PHASE 2: Applying fixes..."
echo ""

# ─── FIX 1: Replace bg-black with bg-[#13100E] ───
echo "Fix 1: bg-black → bg-[#13100E]"
find $SRC_DIR -type f \( -name "*.tsx" -o -name "*.jsx" \) | while read file; do
  if grep -q "bg-black" "$file"; then
    echo "  Patching: $file"
    sed -i '' 's/\bbg-black\b/bg-[#13100E]/g' "$file"
  fi
done

# ─── FIX 2: Replace bg-slate-950, bg-slate-900 with bg-[#13100E] ───
echo "Fix 2: bg-slate-950/900 → bg-[#13100E]"
find $SRC_DIR -type f \( -name "*.tsx" -o -name "*.jsx" \) | while read file; do
  if grep -qE "bg-slate-(950|900)" "$file"; then
    echo "  Patching: $file"
    sed -i '' 's/\bbg-slate-950\b/bg-[#13100E]/g' "$file"
    sed -i '' 's/\bbg-slate-900\b/bg-[#13100E]/g' "$file"
  fi
done

# ─── FIX 3: bg-slate-800 → bg-[#1E1812] (slightly lighter, for surfaces/cards) ───
echo "Fix 3: bg-slate-800 → bg-[#1E1812]"
find $SRC_DIR -type f \( -name "*.tsx" -o -name "*.jsx" \) | while read file; do
  if grep -q "bg-slate-800" "$file"; then
    echo "  Patching: $file"
    sed -i '' 's/\bbg-slate-800\b/bg-[#1E1812]/g' "$file"
  fi
done

# ─── FIX 4: bg-zinc-950, bg-zinc-900 → bg-[#13100E] ───
echo "Fix 4: bg-zinc-950/900 → bg-[#13100E]"
find $SRC_DIR -type f \( -name "*.tsx" -o -name "*.jsx" \) | while read file; do
  if grep -qE "bg-zinc-(950|900)" "$file"; then
    echo "  Patching: $file"
    sed -i '' 's/\bbg-zinc-950\b/bg-[#13100E]/g' "$file"
    sed -i '' 's/\bbg-zinc-900\b/bg-[#13100E]/g' "$file"
  fi
done

# ─── FIX 5: bg-gray-950, bg-gray-900 → bg-[#13100E] ───
echo "Fix 5: bg-gray-950/900 → bg-[#13100E]"
find $SRC_DIR -type f \( -name "*.tsx" -o -name "*.jsx" \) | while read file; do
  if grep -qE "bg-gray-(950|900)" "$file"; then
    echo "  Patching: $file"
    sed -i '' 's/\bbg-gray-950\b/bg-[#13100E]/g' "$file"
    sed -i '' 's/\bbg-gray-900\b/bg-[#13100E]/g' "$file"
  fi
done

# ─── FIX 6: bg-neutral-950, bg-neutral-900 → bg-[#13100E] ───
echo "Fix 6: bg-neutral-950/900 → bg-[#13100E]"
find $SRC_DIR -type f \( -name "*.tsx" -o -name "*.jsx" \) | while read file; do
  if grep -qE "bg-neutral-(950|900)" "$file"; then
    echo "  Patching: $file"
    sed -i '' 's/\bbg-neutral-950\b/bg-[#13100E]/g' "$file"
    sed -i '' 's/\bbg-neutral-900\b/bg-[#13100E]/g' "$file"
  fi
done

echo ""
echo "========================================"
echo "PHASE 2 COMPLETE."
echo ""
echo "Remaining manual fixes required:"
echo ""
echo "CHAT INPUT:"
echo "  Find the chat/message input component."
echo "  Replace any bg-blue-*, bg-indigo-*, or bg-slate-7xx on the input"
echo "  with: bg-[#1E1812] border border-[#2A221A]"
echo "  The input text color should be: text-white or text-[#F5EDE0]"
echo "  Placeholder: placeholder-[#6B5B4E]"
echo ""
echo "TAB BAR PILL:"
echo "  Find the bottom nav / tab bar component."
echo "  Look for: bg-rose-*, bg-[#E8608A], rounded-full on the active tab"
echo "  The active state should be ONLY: text-[#E8608A] (icon + label color)"
echo "  Remove any background, pill, or rounded container from the active tab"
echo "  Inactive tabs: text-[#6B5B4E] or text-[#4A3C35]"
echo ""
echo "Run git diff to review all changes before committing."
echo "========================================"
