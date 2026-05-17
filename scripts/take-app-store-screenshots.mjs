/**
 * take-app-store-screenshots.mjs
 *
 * Captures App Store Connect screenshots for H.I.M. at the three required
 * device sizes. Unauthenticated screens (sign-in, sign-up, forgot-password)
 * are rendered from the live vite-preview server. Authenticated screens
 * (buddy list, DM, rooms) use real app data when credentials are provided,
 * otherwise fall back to pixel-faithful HTML mockups.
 *
 * Output: screenshots/app-store/{device}/XX_screen-name.png
 *
 * Usage:
 *   node scripts/take-app-store-screenshots.mjs
 *
 * Environment variables:
 *   PLAYWRIGHT_USER_A_SCREENNAME   — screenname for authenticated screens
 *   PLAYWRIGHT_USER_A_PASSWORD     — password for authenticated screens
 *   SCREENSHOT_PORT                — port for vite preview (default 4173)
 *   SCREENSHOT_ONLY                — comma-separated screen names to capture
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_ROOT = path.join(ROOT, 'screenshots', 'app-store');
const PORT = process.env.SCREENSHOT_PORT ?? '4173';
const BASE_URL = `http://localhost:${PORT}`;
const ONLY = process.env.SCREENSHOT_ONLY ? process.env.SCREENSHOT_ONLY.split(',').map(s => s.trim()) : null;
const AUTH_SCREENNAME = process.env.PLAYWRIGHT_USER_A_SCREENNAME ?? '';
const AUTH_PASSWORD = process.env.PLAYWRIGHT_USER_A_PASSWORD ?? '';
const HAS_CREDENTIALS = Boolean(AUTH_SCREENNAME && AUTH_PASSWORD);

// ─── Device profiles ──────────────────────────────────────────────────────────

const DEVICES = [
  {
    id: 'iphone-6.9',
    label: '6.9" iPhone (16 Pro Max)',
    width: 1320,
    height: 2868,
    deviceScaleFactor: 1,
  },
  {
    id: 'iphone-6.5',
    label: '6.5" iPhone (14 Plus / 13 Pro Max)',
    width: 1284,
    height: 2778,
    deviceScaleFactor: 1,
  },
  {
    id: 'iphone-5.5',
    label: '5.5" iPhone (8 Plus)',
    width: 1242,
    height: 2208,
    deviceScaleFactor: 1,
  },
];

// ─── CSS design tokens (matches src/app/globals.css) ─────────────────────────

const DESIGN = {
  // Light mode warm stone background
  bodyBg: `radial-gradient(circle at 8% 4%, #F0E8D2 0%, #F5F1E8 38%, #EDE7D9 70%, #E5DDC8 100%)`,
  inkDark: '#0F1424',
  inkMid: '#2A2F45',
  inkFaint: '#565C7A',
  accent: '#E8A23A',
  accentStrong: '#C8861F',
  glassBg: 'rgba(245, 241, 232, 0.62)',
  glassStroke: 'rgba(232, 162, 58, 0.22)',
  cardBg: 'rgba(255,255,255,0.72)',
  cardBorder: 'rgba(255,255,255,0.38)',
  mutedBg: 'rgba(255,255,255,0.48)',
  shellShadow: '0 18px 44px rgba(15,23,42,0.10), inset 0 0.5px 0 rgba(255,255,255,0.55)',
  fontStack: `"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif`,
  statusBarBg: 'rgba(245, 241, 232, 0.92)',
};

// ─── Shared HTML shell ────────────────────────────────────────────────────────

function htmlShell(w, h, title, bodyContent) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/>
<title>${title}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${w}px; height: ${h}px; overflow: hidden;
    font-family: ${DESIGN.fontStack};
    background: ${DESIGN.bodyBg};
    color: ${DESIGN.inkDark};
    -webkit-font-smoothing: antialiased;
    user-select: none;
  }
</style>
</head><body>${bodyContent}</body></html>`;
}

// Status bar (top of every screen)
function statusBar(w) {
  const fontSize = Math.round(w * 0.026);
  const h = Math.round(w * 0.082);
  return `<div style="
    position: absolute; top: 0; left: 0; right: 0;
    height: ${h}px;
    background: ${DESIGN.statusBarBg};
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 ${Math.round(w * 0.05)}px;
    z-index: 100;
    font-size: ${fontSize}px; font-weight: 600; letter-spacing: -0.01em;
  ">
    <span style="color: ${DESIGN.inkDark};">9:41</span>
    <div style="display:flex;gap:${Math.round(w*0.015)}px;align-items:center;">
      <!-- Signal bars -->
      <svg width="${fontSize*1.3}" height="${fontSize}" viewBox="0 0 18 12" fill="${DESIGN.inkDark}">
        <rect x="0" y="8" width="3" height="4" rx="0.5"/>
        <rect x="5" y="5" width="3" height="7" rx="0.5"/>
        <rect x="10" y="2" width="3" height="10" rx="0.5"/>
        <rect x="15" y="0" width="3" height="12" rx="0.5"/>
      </svg>
      <!-- WiFi -->
      <svg width="${fontSize*1.2}" height="${fontSize}" viewBox="0 0 20 14" fill="none" stroke="${DESIGN.inkDark}" stroke-width="1.8">
        <path d="M10 11 a0.5 0.5 0 0 1 0 1 0.5 0.5 0 0 1 0-1z" fill="${DESIGN.inkDark}" stroke="none"/>
        <path d="M5.5 8.5 Q10 4.5 14.5 8.5" stroke-linecap="round"/>
        <path d="M2 5.5 Q10 0 18 5.5" stroke-linecap="round"/>
      </svg>
      <!-- Battery -->
      <svg width="${fontSize*1.6}" height="${fontSize}" viewBox="0 0 26 14" fill="none">
        <rect x="0.5" y="0.5" width="22" height="13" rx="3" stroke="${DESIGN.inkDark}" stroke-width="1.2"/>
        <rect x="23" y="4" width="2.5" height="6" rx="1" fill="${DESIGN.inkDark}" opacity="0.5"/>
        <rect x="2" y="2" width="17" height="10" rx="2" fill="${DESIGN.accent}"/>
      </svg>
    </div>
  </div>`;
}

// H.I.M. wordmark (simplified SVG text)
function himWordmark(size) {
  return `<svg width="${size*3.2}" height="${size}" viewBox="0 0 96 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="22" font-family="${DESIGN.fontStack}" font-size="20" font-weight="800" letter-spacing="-0.06em" fill="${DESIGN.inkDark}">H.I.M.</text>
  </svg>`;
}

// Sparkle icon (app brand mark)
function sparkleIcon(size, color = DESIGN.accent) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
    <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z" fill="${color}"/>
    <circle cx="19" cy="4" r="1.5" fill="${color}" opacity="0.6"/>
    <circle cx="5" cy="19" r="1" fill="${color}" opacity="0.4"/>
  </svg>`;
}

// Bottom tab bar
function tabBar(w, h, activeTab = 'buddies') {
  const tbH = Math.round(w * 0.18);
  const iconSize = Math.round(w * 0.055);
  const fontSize = Math.round(w * 0.022);
  const tabs = [
    { id: 'buddies', label: 'Buddies', icon: '👥' },
    { id: 'rooms', label: 'Rooms', icon: '💬' },
    { id: 'profile', label: 'Profile', icon: '✦' },
  ];
  return `<div style="
    position: absolute; bottom: 0; left: 0; right: 0;
    height: ${tbH}px;
    background: rgba(245, 241, 232, 0.88);
    backdrop-filter: blur(16px);
    border-top: 1px solid ${DESIGN.glassStroke};
    display: flex; align-items: flex-start; padding-top: ${Math.round(tbH * 0.14)}px;
    z-index: 50;
  ">
    ${tabs.map(t => `
      <div style="
        flex: 1; display: flex; flex-direction: column; align-items: center; gap: ${Math.round(w*0.008)}px;
      ">
        <div style="
          font-size: ${iconSize}px; line-height: 1;
          opacity: ${t.id === activeTab ? '1' : '0.42'};
          filter: ${t.id === activeTab ? `drop-shadow(0 1px 4px ${DESIGN.accent}88)` : 'none'};
        ">${t.icon}</div>
        <span style="
          font-size: ${fontSize}px; font-weight: ${t.id === activeTab ? '700' : '500'};
          color: ${t.id === activeTab ? DESIGN.accent : DESIGN.inkFaint};
          letter-spacing: -0.01em;
        ">${t.label}</span>
      </div>
    `).join('')}
  </div>`;
}

// ─── Screen mockup generators ────────────────────────────────────────────────

function buddyListMockup(w, h) {
  const sb = Math.round(w * 0.082);
  const tb = Math.round(w * 0.18);
  const contentH = h - sb - tb;
  const px = Math.round(w * 0.045);
  const titleFz = Math.round(w * 0.065);
  const nameFz = Math.round(w * 0.038);
  const bodyFz = Math.round(w * 0.028);
  const avatarSz = Math.round(w * 0.115);
  const cardR = Math.round(w * 0.042);
  const rowH = Math.round(w * 0.16);

  const buddies = [
    { name: 'xoxo_lauryn', status: 'available', msg: 'just finished my run 🏃', unread: 3, color: '#E8A23A' },
    { name: 'Pakiboy23', status: 'available', msg: 'hey are you coming tonight?', unread: 0, color: '#9C2E2E' },
    { name: 'sk8erboi99', status: 'away', msg: 'Away · brb making coffee', unread: 1, color: '#4A90E2' },
    { name: 'moonlightfm', status: 'available', msg: 'did you see that new show??', unread: 0, color: '#7B4FCC' },
    { name: 'cozytechgirl', status: 'away', msg: 'Away · studying for finals', unread: 0, color: '#2ECC8E' },
  ];

  const onlineBuddies = buddies.filter(b => b.status === 'available');
  const awayBuddies = buddies.filter(b => b.status === 'away');

  function avatarCircle(buddy, size) {
    const initial = buddy.name[0].toUpperCase();
    return `<div style="
      width: ${size}px; height: ${size}px; border-radius: 50%;
      background: linear-gradient(135deg, ${buddy.color}99, ${buddy.color}55);
      border: 2px solid ${buddy.color}44;
      display: flex; align-items: center; justify-content: center;
      font-size: ${Math.round(size*0.42)}px; font-weight: 700; color: ${buddy.color};
      flex-shrink: 0;
    ">${initial}</div>`;
  }

  function presenceDot(status) {
    const sz = Math.round(avatarSz * 0.28);
    const col = status === 'available' ? '#34D399' : '#F59E0B';
    return `<div style="
      position: absolute; bottom: 1px; right: 1px;
      width: ${sz}px; height: ${sz}px; border-radius: 50%;
      background: ${col}; border: 2px solid #F5F1E8;
    "></div>`;
  }

  function buddyRow(buddy) {
    const hasUnread = buddy.unread > 0;
    return `<div style="
      display: flex; align-items: center; gap: ${Math.round(w*0.032)}px;
      padding: ${Math.round(rowH*0.14)}px ${px}px;
      border-bottom: 1px solid rgba(15,20,36,0.06);
      background: ${hasUnread ? 'rgba(232,162,58,0.04)' : 'transparent'};
    ">
      <div style="position: relative; flex-shrink: 0;">
        ${avatarCircle(buddy, avatarSz)}
        ${presenceDot(buddy.status)}
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span style="
            font-size: ${nameFz}px; font-weight: ${hasUnread ? '700' : '600'};
            color: ${DESIGN.inkDark}; letter-spacing: -0.02em;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          ">${buddy.name}</span>
          ${hasUnread ? `<span style="
            min-width: ${Math.round(nameFz*1.4)}px; height: ${Math.round(nameFz*1.4)}px;
            background: ${DESIGN.accent}; color: white; border-radius: 999px;
            font-size: ${Math.round(nameFz*0.72)}px; font-weight: 700;
            display: flex; align-items: center; justify-content: center;
            padding: 0 ${Math.round(nameFz*0.3)}px; flex-shrink: 0;
          ">${buddy.unread}</span>` : ''}
        </div>
        <span style="
          display: block; margin-top: ${Math.round(w*0.005)}px;
          font-size: ${bodyFz}px; color: ${hasUnread ? DESIGN.inkMid : DESIGN.inkFaint};
          font-weight: ${hasUnread ? '500' : '400'};
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        ">${buddy.msg}</span>
      </div>
    </div>`;
  }

  function sectionHeader(label, count) {
    return `<div style="
      padding: ${Math.round(w*0.028)}px ${px}px ${Math.round(w*0.012)}px;
      font-size: ${Math.round(w*0.025)}px; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      color: ${DESIGN.inkFaint};
    ">${label} (${count})</div>`;
  }

  return htmlShell(w, h, 'H.I.M. — Buddy List', `
  ${statusBar(w)}
  <div style="position: absolute; top: ${sb}px; left: 0; right: 0; bottom: ${tb}px; overflow: hidden;">
    <!-- Header -->
    <div style="
      padding: ${Math.round(w*0.05)}px ${px}px ${Math.round(w*0.03)}px;
      border-bottom: 1px solid ${DESIGN.glassStroke};
      background: rgba(245,241,232,0.8);
    ">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          ${himWordmark(Math.round(w*0.045))}
          <div style="margin-top: ${Math.round(w*0.01)}px; font-size: ${titleFz}px; font-weight: 700; letter-spacing: -0.04em; color: ${DESIGN.inkDark};">
            Hi, It's Me.
          </div>
        </div>
        <div style="
          width: ${Math.round(w*0.115)}px; height: ${Math.round(w*0.115)}px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${DESIGN.accent}55, ${DESIGN.accent}22);
          border: 2px solid ${DESIGN.glassStroke};
          display: flex; align-items: center; justify-content: center;
          font-size: ${Math.round(w*0.048)}px; font-weight: 700; color: ${DESIGN.accent};
        ">P</div>
      </div>
      <!-- Search bar -->
      <div style="
        margin-top: ${Math.round(w*0.03)}px;
        background: rgba(255,255,255,0.62); border: 1px solid ${DESIGN.cardBorder};
        border-radius: ${Math.round(w*0.038)}px;
        padding: ${Math.round(w*0.022)}px ${Math.round(w*0.035)}px;
        display: flex; align-items: center; gap: ${Math.round(w*0.02)}px;
        color: ${DESIGN.inkFaint}; font-size: ${Math.round(w*0.03)}px;
      ">
        <svg width="${Math.round(w*0.035)}" height="${Math.round(w*0.035)}" viewBox="0 0 20 20" fill="none" stroke="${DESIGN.inkFaint}" stroke-width="1.8">
          <circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l3.5 3.5" stroke-linecap="round"/>
        </svg>
        Search buddies...
      </div>
    </div>
    <!-- Buddy list -->
    <div style="overflow: hidden; height: calc(100% - ${Math.round(w*0.32)}px);">
      ${sectionHeader('Online', onlineBuddies.length)}
      ${onlineBuddies.map(buddyRow).join('')}
      ${sectionHeader('Away', awayBuddies.length)}
      ${awayBuddies.map(buddyRow).join('')}
    </div>
  </div>
  ${tabBar(w, h, 'buddies')}
  `);
}

function dmConversationMockup(w, h) {
  const sb = Math.round(w * 0.082);
  const tb = Math.round(w * 0.18);
  const contentH = h - sb - tb;
  const px = Math.round(w * 0.045);
  const nameFz = Math.round(w * 0.04);
  const msgFz = Math.round(w * 0.033);
  const timeFz = Math.round(w * 0.024);
  const avatarSz = Math.round(w * 0.085);
  const bubbleR = Math.round(w * 0.042);

  const messages = [
    { from: 'other', name: 'xoxo_lauryn', text: 'just finished my run!! 🏃‍♀️ feeling so good rn', time: '4:12 PM' },
    { from: 'me', text: 'omg nice!! how far did you go', time: '4:14 PM' },
    { from: 'other', name: 'xoxo_lauryn', text: '5k! personal best 🎉 are you coming to the thing tonight?', time: '4:15 PM' },
    { from: 'me', text: 'yes definitely!! what time again?', time: '4:16 PM' },
    { from: 'other', name: 'xoxo_lauryn', text: '8pm at the usual spot, don\'t be late lol', time: '4:17 PM' },
    { from: 'me', text: 'never 😇 see you then!', time: '4:18 PM' },
    { from: 'other', name: 'xoxo_lauryn', text: '✨', time: '4:18 PM' },
  ];

  function bubble(msg) {
    const isMe = msg.from === 'me';
    const bgColor = isMe ? DESIGN.accent : 'rgba(255,255,255,0.82)';
    const textColor = isMe ? 'white' : DESIGN.inkDark;
    const maxW = Math.round(w * 0.68);

    return `<div style="
      display: flex; flex-direction: ${isMe ? 'row-reverse' : 'row'};
      align-items: flex-end; gap: ${Math.round(w*0.02)}px;
      margin-bottom: ${Math.round(w*0.022)}px;
      padding: 0 ${px}px;
    ">
      ${!isMe ? `<div style="
        width: ${avatarSz}px; height: ${avatarSz}px; border-radius: 50%;
        background: linear-gradient(135deg, #E8A23A55, #E8A23A22);
        border: 2px solid #E8A23A33;
        display: flex; align-items: center; justify-content: center;
        font-size: ${Math.round(avatarSz*0.42)}px; font-weight: 700; color: ${DESIGN.accent};
        flex-shrink: 0;
      ">L</div>` : ''}
      <div style="max-width: ${maxW}px;">
        ${!isMe && msg.name ? `<span style="
          display: block; margin-bottom: ${Math.round(w*0.008)}px;
          font-size: ${timeFz}px; font-weight: 600; color: ${DESIGN.inkFaint};
          padding-left: ${Math.round(w*0.01)}px;
        ">${msg.name}</span>` : ''}
        <div style="
          background: ${bgColor};
          border: 1px solid ${isMe ? 'transparent' : DESIGN.cardBorder};
          border-radius: ${bubbleR}px;
          ${isMe ? `border-bottom-right-radius: ${Math.round(bubbleR*0.3)}px;` : `border-bottom-left-radius: ${Math.round(bubbleR*0.3)}px;`}
          padding: ${Math.round(w*0.025)}px ${Math.round(w*0.035)}px;
          box-shadow: 0 2px 8px rgba(15,20,36,0.08);
        ">
          <span style="font-size: ${msgFz}px; color: ${textColor}; line-height: 1.42;">${msg.text}</span>
        </div>
        <span style="
          display: block; margin-top: ${Math.round(w*0.006)}px;
          font-size: ${timeFz}px; color: ${DESIGN.inkFaint};
          text-align: ${isMe ? 'right' : 'left'};
          padding: 0 ${Math.round(w*0.01)}px;
        ">${msg.time}</span>
      </div>
    </div>`;
  }

  const inputH = Math.round(w * 0.11);

  return htmlShell(w, h, 'DM — xoxo_lauryn', `
  ${statusBar(w)}
  <!-- Nav header -->
  <div style="
    position: absolute; top: ${sb}px; left: 0; right: 0;
    height: ${Math.round(w*0.15)}px;
    background: rgba(245,241,232,0.9); backdrop-filter: blur(12px);
    border-bottom: 1px solid ${DESIGN.glassStroke};
    display: flex; align-items: center; gap: ${Math.round(w*0.03)}px;
    padding: 0 ${px}px;
    z-index: 10;
  ">
    <svg width="${Math.round(w*0.04)}" height="${Math.round(w*0.04)}" viewBox="0 0 12 20" fill="none" stroke="${DESIGN.accent}" stroke-width="2" stroke-linecap="round">
      <path d="M10 2L2 10L10 18"/>
    </svg>
    <div style="
      width: ${Math.round(w*0.1)}px; height: ${Math.round(w*0.1)}px; border-radius: 50%;
      background: linear-gradient(135deg, #E8A23A55, #E8A23A22);
      border: 2px solid #E8A23A33;
      display: flex; align-items: center; justify-content: center;
      font-size: ${Math.round(w*0.042)}px; font-weight: 700; color: ${DESIGN.accent};
    ">L</div>
    <div>
      <div style="font-size: ${nameFz}px; font-weight: 700; color: ${DESIGN.inkDark}; letter-spacing: -0.025em;">xoxo_lauryn</div>
      <div style="display: flex; align-items: center; gap: ${Math.round(w*0.012)}px; margin-top: 2px;">
        <div style="width: ${Math.round(w*0.018)}px; height: ${Math.round(w*0.018)}px; border-radius: 50%; background: #34D399;"></div>
        <span style="font-size: ${Math.round(w*0.024)}px; color: ${DESIGN.inkFaint};">Online now</span>
      </div>
    </div>
  </div>
  <!-- Messages -->
  <div style="
    position: absolute;
    top: ${sb + Math.round(w*0.15)}px;
    left: 0; right: 0;
    bottom: ${tb + inputH}px;
    overflow: hidden;
    padding-top: ${Math.round(w*0.03)}px;
  ">
    ${messages.map(bubble).join('')}
  </div>
  <!-- Input bar -->
  <div style="
    position: absolute;
    bottom: ${tb}px; left: 0; right: 0;
    height: ${inputH}px;
    background: rgba(245,241,232,0.92); backdrop-filter: blur(12px);
    border-top: 1px solid ${DESIGN.glassStroke};
    display: flex; align-items: center; gap: ${Math.round(w*0.025)}px;
    padding: 0 ${px}px;
    z-index: 10;
  ">
    <div style="
      flex: 1; background: rgba(255,255,255,0.72); border: 1px solid ${DESIGN.cardBorder};
      border-radius: ${Math.round(inputH*0.42)}px;
      padding: ${Math.round(inputH*0.2)}px ${Math.round(w*0.035)}px;
      font-size: ${Math.round(w*0.03)}px; color: ${DESIGN.inkFaint};
    ">Type your message...</div>
    <div style="
      width: ${Math.round(inputH*0.68)}px; height: ${Math.round(inputH*0.68)}px;
      background: ${DESIGN.accent}; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    ">
      <svg width="${Math.round(inputH*0.32)}" height="${Math.round(inputH*0.32)}" viewBox="0 0 14 14" fill="white">
        <path d="M1 7h12M8 3l5 4-5 4" stroke="white" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      </svg>
    </div>
  </div>
  ${tabBar(w, h, 'buddies')}
  `);
}

function roomsBrowseMockup(w, h) {
  const sb = Math.round(w * 0.082);
  const tb = Math.round(w * 0.18);
  const px = Math.round(w * 0.045);
  const titleFz = Math.round(w * 0.055);
  const nameFz = Math.round(w * 0.038);
  const bodyFz = Math.round(w * 0.028);
  const cardR = Math.round(w * 0.048);
  const cardPad = Math.round(w * 0.042);
  const iconSz = Math.round(w * 0.11);

  const rooms = [
    { emoji: '🗽', name: 'New York', desc: 'The city that never sleeps', members: 847, kind: 'regional' },
    { emoji: '🌴', name: 'LA Vibes', desc: 'Chill, sun, and good company', members: 613, kind: 'regional' },
    { emoji: '🎵', name: 'Music Heads', desc: 'What are you listening to?', members: 1204, kind: 'vibe' },
    { emoji: '✈️', name: 'Travel Talk', desc: 'Share your adventures', members: 445, kind: 'vibe' },
    { emoji: '🏀', name: 'Sports Central', desc: 'Live reactions, hot takes', members: 932, kind: 'vibe' },
  ];

  function roomCard(room) {
    return `<div style="
      background: ${DESIGN.cardBg}; border: 1px solid ${DESIGN.cardBorder};
      border-radius: ${cardR}px;
      padding: ${cardPad}px;
      box-shadow: ${DESIGN.shellShadow};
      display: flex; align-items: center; gap: ${Math.round(w*0.035)}px;
      margin-bottom: ${Math.round(w*0.025)}px;
    ">
      <div style="
        width: ${iconSz}px; height: ${iconSz}px; border-radius: ${Math.round(iconSz*0.32)}px;
        background: linear-gradient(135deg, ${DESIGN.accent}22, ${DESIGN.accent}08);
        border: 1px solid ${DESIGN.glassStroke};
        display: flex; align-items: center; justify-content: center;
        font-size: ${Math.round(iconSz*0.52)}px; flex-shrink: 0;
      ">${room.emoji}</div>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: ${nameFz}px; font-weight: 700; color: ${DESIGN.inkDark}; letter-spacing: -0.02em;">${room.name}</span>
          <span style="
            padding: ${Math.round(w*0.008)}px ${Math.round(w*0.02)}px;
            background: ${DESIGN.accent}18; border: 1px solid ${DESIGN.accent}33;
            border-radius: 999px; font-size: ${Math.round(w*0.022)}px;
            font-weight: 600; color: ${DESIGN.accentStrong};
          ">${room.members.toLocaleString()} online</span>
        </div>
        <span style="
          display: block; margin-top: ${Math.round(w*0.008)}px;
          font-size: ${bodyFz}px; color: ${DESIGN.inkFaint}; line-height: 1.3;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        ">${room.desc}</span>
      </div>
    </div>`;
  }

  return htmlShell(w, h, 'H.I.M. — Chat Rooms', `
  ${statusBar(w)}
  <div style="position: absolute; top: ${sb}px; left: 0; right: 0; bottom: ${tb}px; overflow: hidden;">
    <!-- Header -->
    <div style="
      padding: ${Math.round(w*0.05)}px ${px}px ${Math.round(w*0.03)}px;
      border-bottom: 1px solid ${DESIGN.glassStroke};
      background: rgba(245,241,232,0.8);
    ">
      <div style="font-size: ${titleFz}px; font-weight: 700; letter-spacing: -0.04em; color: ${DESIGN.inkDark};">Chat Rooms</div>
      <div style="font-size: ${bodyFz}px; color: ${DESIGN.inkFaint}; margin-top: ${Math.round(w*0.01)}px;">Join a conversation already in progress</div>
      <!-- Search -->
      <div style="
        margin-top: ${Math.round(w*0.03)}px;
        background: rgba(255,255,255,0.62); border: 1px solid ${DESIGN.cardBorder};
        border-radius: ${Math.round(w*0.038)}px;
        padding: ${Math.round(w*0.022)}px ${Math.round(w*0.035)}px;
        display: flex; align-items: center; gap: ${Math.round(w*0.02)}px;
        color: ${DESIGN.inkFaint}; font-size: ${Math.round(w*0.03)}px;
      ">
        <svg width="${Math.round(w*0.035)}" height="${Math.round(w*0.035)}" viewBox="0 0 20 20" fill="none" stroke="${DESIGN.inkFaint}" stroke-width="1.8">
          <circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l3.5 3.5" stroke-linecap="round"/>
        </svg>
        Search rooms...
      </div>
    </div>
    <!-- Room list -->
    <div style="padding: ${Math.round(w*0.03)}px ${px}px; overflow: hidden;">
      <div style="
        font-size: ${Math.round(w*0.024)}px; font-weight: 700; letter-spacing: 0.08em;
        text-transform: uppercase; color: ${DESIGN.inkFaint};
        margin-bottom: ${Math.round(w*0.02)}px;
      ">All Rooms · ${rooms.length} active</div>
      ${rooms.map(roomCard).join('')}
    </div>
  </div>
  ${tabBar(w, h, 'rooms')}
  `);
}

// ─── Server management ────────────────────────────────────────────────────────

async function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const { default: http } = await import('node:http');
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => { res.resume(); resolve(); });
        req.on('error', reject);
        req.setTimeout(1000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  return false;
}

async function startPreviewServer() {
  console.log(`  Starting vite preview on port ${PORT}…`);
  const server = spawn('npx', ['vite', 'preview', '--port', PORT, '--host', 'localhost'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => process.stdout.write(`  [vite] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`  [vite] ${d}`));

  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    server.kill();
    throw new Error(`Vite preview did not start on ${BASE_URL} within 15 s`);
  }
  console.log(`  Server ready at ${BASE_URL}`);
  return server;
}

// ─── Screenshot capture ───────────────────────────────────────────────────────

async function captureScreens(page, device, outDir, baseUrl) {
  const { width: w, height: h } = device;
  const results = [];

  async function shot(slug, url, waitFor = 'networkidle', extraWaitMs = 0) {
    if (ONLY && !ONLY.includes(slug)) return;
    const filePath = path.join(outDir, `${slug}.png`);
    console.log(`    → ${slug}`);
    await page.goto(url, { waitUntil: waitFor, timeout: 20000 });
    if (extraWaitMs) await page.waitForTimeout(extraWaitMs);
    // Wait for fonts / CSS
    await page.waitForTimeout(800);
    await page.screenshot({ path: filePath, type: 'png' });
    const stat = await fs.stat(filePath);
    results.push({ slug, filePath, size: stat.size });
  }

  async function shotHtml(slug, html) {
    if (ONLY && !ONLY.includes(slug)) return;
    const filePath = path.join(outDir, `${slug}.png`);
    console.log(`    → ${slug} (mockup)`);
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: filePath, type: 'png' });
    const stat = await fs.stat(filePath);
    results.push({ slug, filePath, size: stat.size, isMockup: true });
  }

  // ── 01 Sign-in ──
  await shot('01_sign-in', baseUrl + '/', 'networkidle', 500);

  // ── 02 Sign-up (click the Create account tab) ──
  if (!ONLY || ONLY.includes('02_sign-up')) {
    const filePath = path.join(outDir, '02_sign-up.png');
    console.log(`    → 02_sign-up`);
    await page.goto(baseUrl + '/', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(600);
    // Click the "Create account" tab
    await page.locator('button', { hasText: 'Create account' }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: filePath, type: 'png' });
    const stat = await fs.stat(filePath);
    results.push({ slug: '02_sign-up', filePath, size: stat.size });
  }

  // ── 03 Forgot password ──
  if (!ONLY || ONLY.includes('03_forgot-password')) {
    const filePath = path.join(outDir, '03_forgot-password.png');
    console.log(`    → 03_forgot-password`);
    await page.goto(baseUrl + '/', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(600);
    await page.locator('button', { hasText: 'Forgot password?' }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: filePath, type: 'png' });
    const stat = await fs.stat(filePath);
    results.push({ slug: '03_forgot-password', filePath, size: stat.size });
  }

  // ── 04 Buddy list ──
  if (HAS_CREDENTIALS) {
    if (!ONLY || ONLY.includes('04_buddy-list')) {
      const filePath = path.join(outDir, '04_buddy-list.png');
      console.log(`    → 04_buddy-list (live)`);
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(500);
      // Sign in
      await page.locator('input.ui-screenname').fill(AUTH_SCREENNAME);
      await page.locator('input[autocomplete="current-password"]').fill(AUTH_PASSWORD);
      await page.locator('button[type="submit"]').click();
      // Wait for redirect to /hi-its-me
      await page.waitForURL('**/hi-its-me**', { timeout: 20000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: filePath, type: 'png' });
      const stat = await fs.stat(filePath);
      results.push({ slug: '04_buddy-list', filePath, size: stat.size });
    }
  } else {
    await shotHtml('04_buddy-list', buddyListMockup(w, h));
  }

  // ── 05 DM conversation ──
  if (HAS_CREDENTIALS) {
    if (!ONLY || ONLY.includes('05_direct-message')) {
      const filePath = path.join(outDir, '05_direct-message.png');
      console.log(`    → 05_direct-message (live)`);
      // Click the first DM row (data-testid starts with dm-row-)
      const firstDm = page.locator('[data-testid^="dm-row-"]').first();
      const hasDm = await firstDm.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasDm) {
        await firstDm.click();
        await page.waitForTimeout(2000);
      }
      await page.screenshot({ path: filePath, type: 'png' });
      const stat = await fs.stat(filePath);
      results.push({ slug: '05_direct-message', filePath, size: stat.size });
    }
  } else {
    await shotHtml('05_direct-message', dmConversationMockup(w, h));
  }

  // ── 06 Chat rooms ──
  if (HAS_CREDENTIALS) {
    if (!ONLY || ONLY.includes('06_chat-rooms')) {
      const filePath = path.join(outDir, '06_chat-rooms.png');
      console.log(`    → 06_chat-rooms (live)`);
      // Click the Chat tab
      const chatTab = page.locator('.ui-tabbar-button', { hasText: /chat/i }).first();
      const hasTab = await chatTab.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasTab) {
        await chatTab.click();
        await page.waitForTimeout(1500);
      } else {
        // Fallback: navigate directly
        await page.goto(BASE_URL + '/hi-its-me?tab=chat', { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(2000);
      }
      await page.screenshot({ path: filePath, type: 'png' });
      const stat = await fs.stat(filePath);
      results.push({ slug: '06_chat-rooms', filePath, size: stat.size });
    }
  } else {
    await shotHtml('06_chat-rooms', roomsBrowseMockup(w, h));
  }

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  H.I.M. — App Store Connect Screenshot Generator     ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // Create output directories
  for (const device of DEVICES) {
    await fs.mkdir(path.join(OUT_ROOT, device.id), { recursive: true });
  }

  // Start preview server
  let server;
  const serverAlreadyRunning = await waitForServer(BASE_URL, 1000);
  if (!serverAlreadyRunning) {
    server = await startPreviewServer();
  } else {
    console.log(`  Detected existing server at ${BASE_URL}`);
  }

  const browser = await chromium.launch({ headless: true });

  const allResults = {};

  try {
    for (const device of DEVICES) {
      console.log(`\n  Device: ${device.label} (${device.width}×${device.height})`);
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        deviceScaleFactor: device.deviceScaleFactor,
      });
      const page = await context.newPage();
      const outDir = path.join(OUT_ROOT, device.id);

      const results = await captureScreens(page, device, outDir, BASE_URL);
      allResults[device.id] = results;

      await context.close();
    }
  } finally {
    await browser.close();
    if (server) {
      server.kill();
      console.log('\n  Preview server stopped.');
    }
  }

  // ── Print summary ──
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  Summary                                              ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  let totalFiles = 0;
  for (const device of DEVICES) {
    const results = allResults[device.id] ?? [];
    if (!results.length) continue;
    console.log(`  ${device.label}`);
    for (const r of results) {
      const kb = Math.round(r.size / 1024);
      const tag = r.isMockup ? ' [mockup]' : ' [live]  ';
      console.log(`    ${tag} ${r.slug}.png  (${kb} KB)`);
      totalFiles++;
    }
  }

  console.log(`\n  Total: ${totalFiles} screenshots`);
  console.log(`  Output: ${OUT_ROOT}\n`);

  if (HAS_CREDENTIALS) {
    console.log(`  Authenticated as: ${AUTH_SCREENNAME}\n`);
  } else {
    console.log('  Authenticated screens used mockups (no credentials).');
    console.log('  To capture live screens, set:');
    console.log('    PLAYWRIGHT_USER_A_SCREENNAME=<screenname>');
    console.log('    PLAYWRIGHT_USER_A_PASSWORD=<password>');
    console.log('  then re-run this script.\n');
  }
}

await main();
