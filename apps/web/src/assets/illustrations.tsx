/**
 * Lichte Klimop illustrated asset set — Dutch motifs (tulip, bike, windmill, canal).
 * Soft flat fills + Lucide-adapted strokes. Limited cream / orange / green / sky / gold palette.
 * No custom mascot characters. See ./ATTRIBUTION.md for licenses.
 */
import type { SVGProps } from 'react'

const C = {
  cream: '#FFF8F0',
  white: '#FFFFFF',
  ink: '#1C2430',
  muted: '#5B6675',
  orange: '#E36A1E',
  orangeLite: '#F08A45',
  green: '#2F9E6B',
  greenDeep: '#1F7A52',
  greenLite: '#5BC48F',
  sky: '#3B82C4',
  skyLite: '#DCEBFA',
  gold: '#F0B429',
  bank: '#E8D5BC',
} as const

type ArtProps = SVGProps<SVGSVGElement> & { title?: string }

/** Soft-fill tulip motif (project CC0 geometric mark). */
function TulipIcon({
  x = 0,
  y = 0,
  scale = 1,
  uid = 'tulip',
}: {
  x?: number
  y?: number
  scale?: number
  uid?: string
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M16 4c-1.2 5-6 9-6 14 0 4 3 6.5 6 6.5s6-2.5 6-6.5c0-5-4.8-9-6-14z" fill={C.orange} />
      <path d="M16 4c1 4 4 7 5 12-2-3-4-6-5-9V4z" fill={C.orangeLite} opacity="0.9" />
      <path d="M16 24.5v8" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 28c-5 1.2-9 0-10-2.5 4 0 7.5 1.2 10 2.5z" fill={C.green} />
      <path d="M16 27c5 1.2 9 0 10-2.5-4 0-7.5 1.2-10 2.5z" fill={C.greenLite} />
      <circle cx="16" cy="12" r="1.6" fill={C.gold} opacity="0.85" />
      {/* uid kept for unique defs if needed later */}
      <title id={uid} />
    </g>
  )
}

/** Soft-fill windmill / molen motif (project CC0 geometric mark). */
function WindmillIcon({
  x = 0,
  y = 0,
  scale = 1,
}: {
  x?: number
  y?: number
  scale?: number
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="14" y="18" width="4" height="18" rx="1.2" fill={C.muted} />
      <path d="M8 36h16" stroke={C.ink} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
      <circle cx="16" cy="16" r="3" fill={C.orange} />
      <path d="M16 16 L26 6 L28.5 8.5 L18.5 18.5 Z" fill={C.sky} />
      <path d="M16 16 L26 26 L23.5 28.5 L13.5 18.5 Z" fill={C.gold} />
      <path d="M16 16 L6 26 L3.5 23.5 L13.5 13.5 Z" fill={C.sky} />
      <path d="M16 16 L6 6 L8.5 3.5 L18.5 13.5 Z" fill={C.gold} />
    </g>
  )
}

/** Bike motif adapted from Lucide bike (MIT) — colored soft dots on hubs. */
function BikeIcon({
  x = 0,
  y = 0,
  scale = 1,
  stroke = C.ink,
}: {
  x?: number
  y?: number
  scale?: number
  stroke?: string
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18.5" cy="17.5" r="3.5" />
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="15" cy="5" r="1" fill={C.orange} stroke="none" />
      <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
      <circle cx="5.5" cy="17.5" r="1.2" fill={C.orange} stroke="none" />
      <circle cx="18.5" cy="17.5" r="1.2" fill={C.orange} stroke="none" />
    </g>
  )
}

/** App logo / brand mark — clean tulip in a soft circle (not a creature). */
export function IvyMark({ size = 26, className = 'topBarBrandMark illustration', ...rest }: ArtProps & { size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      {...rest}
    >
      <defs>
        <linearGradient id="mark-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.gold} />
          <stop offset="100%" stopColor={C.orange} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={C.cream} />
      <circle cx="32" cy="32" r="28" fill="none" stroke="url(#mark-rim)" strokeWidth="2.5" />
      {/* tulip */}
      <path d="M32 14c-2 8-10 14-10 22 0 6 4.5 10 10 10s10-4 10-10c0-8-8-14-10-22z" fill={C.orange} />
      <path d="M32 14c1.5 6 6 11 7.5 18.5C37 28 34 24 32 20v-6z" fill={C.orangeLite} opacity="0.9" />
      <path d="M32 46v10" stroke={C.green} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M32 52c-7 1.5-12 0-14-3 5 0 10 1.5 14 3z" fill={C.green} />
      <path d="M32 51c7 1.5 12 0 14-3-5 0-10 1.5-14 3z" fill={C.greenLite} />
      <circle cx="32" cy="28" r="2.5" fill={C.gold} />
    </svg>
  )
}

/** Home hero — canal, bike, windmill, tulips (Dutch gezellig, no mascot). */
export function HomeHeaderArt({ className = 'homeHeroArt illustration', ...rest }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 240 150" aria-hidden {...rest}>
      <defs>
        <linearGradient id="home-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8F3FC" />
          <stop offset="100%" stopColor={C.skyLite} />
        </linearGradient>
        <linearGradient id="home-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A8CDEA" />
          <stop offset="100%" stopColor={C.sky} />
        </linearGradient>
        <linearGradient id="home-house" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.cream} />
          <stop offset="100%" stopColor="#F5E6D4" />
        </linearGradient>
      </defs>

      <rect width="240" height="150" rx="18" fill="url(#home-sky)" />
      <circle cx="48" cy="36" r="16" fill={C.gold} opacity="0.95" />
      <circle cx="48" cy="36" r="22" fill={C.gold} opacity="0.18" />
      <ellipse cx="170" cy="28" rx="22" ry="10" fill={C.white} opacity="0.7" />
      <ellipse cx="188" cy="30" rx="14" ry="8" fill={C.white} opacity="0.55" />

      <path d="M0 108h240v42H0z" fill="url(#home-water)" opacity="0.55" />
      <path d="M0 108c40 8 80-6 120 2s70 6 120-4v12H0z" fill={C.sky} opacity="0.2" />
      <rect x="0" y="98" width="240" height="12" fill={C.bank} />

      {/* canal house */}
      <path d="M148 98 L178 58 L208 98 Z" fill={C.orange} />
      <rect x="154" y="72" width="48" height="36" fill="url(#home-house)" stroke={C.ink} strokeWidth="1.5" />
      <rect x="168" y="84" width="12" height="24" rx="1" fill={C.orange} />
      <rect x="158" y="78" width="10" height="10" rx="1" fill={C.skyLite} stroke={C.sky} strokeWidth="1" />
      <rect x="188" y="78" width="10" height="10" rx="1" fill={C.skyLite} stroke={C.sky} strokeWidth="1" />

      {/* windmill (molen) */}
      <WindmillIcon x={95} y={48} scale={1.35} />

      {/* bike — Lucide-adapted */}
      <BikeIcon x={28} y={78} scale={1.15} />

      {/* tulips on the bank */}
      <TulipIcon x={210} y={78} scale={0.7} uid="home-t1" />
      <TulipIcon x={222} y={82} scale={0.55} uid="home-t2" />
    </svg>
  )
}

/** Daily practice header — morning sun + open book + tulip. */
export function DailyHeaderArt({ className = 'dailyHeaderArt illustration', ...rest }: ArtProps) {
  return (
    <svg className={className} width="96" height="64" viewBox="0 0 140 90" aria-hidden {...rest}>
      <defs>
        <radialGradient id="daily-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE08A" />
          <stop offset="100%" stopColor={C.gold} />
        </radialGradient>
        <linearGradient id="daily-book" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.cream} />
          <stop offset="100%" stopColor="#F0E0CC" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="30" r="18" fill="url(#daily-sun)" />
      <circle cx="32" cy="30" r="24" fill={C.gold} opacity="0.2" />
      {/* open book — Lucide book-open spirit */}
      <g transform="translate(58 38)">
        <path d="M0 8 L22 0 L22 28 L0 32 Z" fill="url(#daily-book)" stroke={C.ink} strokeWidth="1.4" />
        <path d="M22 0 L44 8 L44 32 L22 28 Z" fill={C.cream} stroke={C.ink} strokeWidth="1.4" />
        <path d="M6 12h10M6 18h8M28 12h10M28 18h8" stroke={C.muted} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        <path d="M22 0v28" stroke={C.orange} strokeWidth="2" />
      </g>
      <TulipIcon x={108} y={42} scale={0.85} uid="daily-t" />
    </svg>
  )
}

/** Progress — rising bars + climbing vine + windmill accent. */
export function ProgressHeaderArt({ className = 'progressHeroArt illustration', ...rest }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 260 100" aria-hidden {...rest}>
      <defs>
        <linearGradient id="prog-bar" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={C.orange} />
          <stop offset="100%" stopColor={C.orangeLite} />
        </linearGradient>
        <linearGradient id="prog-vine" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={C.greenDeep} />
          <stop offset="100%" stopColor={C.greenLite} />
        </linearGradient>
      </defs>
      <ellipse cx="130" cy="92" rx="110" ry="8" fill={C.sky} opacity="0.12" />
      <path d="M24 88h212" stroke={C.sky} strokeWidth="3" opacity="0.3" strokeLinecap="round" />
      {[
        [40, 52], [70, 40], [100, 28], [130, 44], [160, 20], [190, 34],
      ].map(([x, h], i) => (
        <rect key={i} x={x} y={88 - h} width="14" height={h} rx="7" fill="url(#prog-bar)" opacity={0.75 + i * 0.04} />
      ))}
      <path d="M210 88c4-20 14-32 28-40" fill="none" stroke="url(#prog-vine)" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="228" cy="42" rx="10" ry="7" fill={C.green} transform="rotate(-30 228 42)" />
      <ellipse cx="238" cy="52" rx="8" ry="5" fill={C.greenLite} transform="rotate(20 238 52)" />
      <circle cx="242" cy="36" r="4" fill={C.gold} />
      <WindmillIcon x={145} y={18} scale={1.4} />
    </svg>
  )
}

/** Empty queue / pause — parked bike + tulips under soft sun. */
export function EmptyQueueArt({ className = 'emptyStateArt illustration', ...rest }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 180 120" aria-hidden {...rest}>
      <defs>
        <radialGradient id="empty-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE08A" />
          <stop offset="100%" stopColor={C.gold} />
        </radialGradient>
      </defs>
      <ellipse cx="90" cy="100" rx="55" ry="10" fill={C.sky} opacity="0.14" />
      <circle cx="140" cy="28" r="16" fill="url(#empty-sun)" />
      <circle cx="140" cy="28" r="22" fill={C.gold} opacity="0.18" />
      <path d="M30 95c4-10 10-10 12 0M48 95c3-8 8-8 10 0M118 95c4-9 9-9 11 0" fill="none" stroke={C.green} strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      <BikeIcon x={48} y={52} scale={2.2} />
      <TulipIcon x={118} y={48} scale={1.1} uid="empty-t1" />
      <TulipIcon x={138} y={54} scale={0.85} uid="empty-t2" />
    </svg>
  )
}

/** Grammar — notebook with tulip accent (no peeking character). */
export function GrammarNotebookArt({ className = 'grammarHeaderArt illustration', ...rest }: ArtProps) {
  return (
    <svg className={className} width="88" height="64" viewBox="0 0 130 95" aria-hidden {...rest}>
      <defs>
        <linearGradient id="gram-cover" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.cream} />
          <stop offset="100%" stopColor="#F2E2CE" />
        </linearGradient>
      </defs>
      <rect x="28" y="18" width="72" height="64" rx="8" fill="url(#gram-cover)" stroke={C.ink} strokeWidth="1.8" />
      <path d="M40 18v64" stroke={C.orange} strokeWidth="4" strokeLinecap="round" />
      <path d="M50 34h40M50 46h40M50 58h26" stroke={C.muted} strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      {[28, 42, 56, 70].map((cy) => (
        <circle key={cy} cx="40" cy={cy} r="3.5" fill="none" stroke={C.sky} strokeWidth="1.5" />
      ))}
      <TulipIcon x={96} y={8} scale={0.75} uid="gram-t" />
      <circle cx="108" cy="72" r="4" fill={C.gold} />
    </svg>
  )
}

/** De of Het — polished article tags with orange accent mark. */
export function DeHetTagsArt({ className = 'deofhetArt illustration', ...rest }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 160 80" aria-hidden {...rest}>
      <rect x="8" y="22" width="56" height="36" rx="18" fill="rgba(227,106,30,0.14)" stroke={C.orange} strokeWidth="2.2" />
      <text x="36" y="46" textAnchor="middle" fontSize="18" fontWeight="800" fill={C.orange} fontFamily="ui-sans-serif,system-ui,sans-serif">de</text>
      <rect x="72" y="22" width="56" height="36" rx="18" fill="rgba(59,130,196,0.14)" stroke={C.sky} strokeWidth="2.2" />
      <text x="100" y="46" textAnchor="middle" fontSize="18" fontWeight="800" fill={C.sky} fontFamily="ui-sans-serif,system-ui,sans-serif">het</text>
      <TulipIcon x={128} y={18} scale={0.9} uid="dh-t" />
    </svg>
  )
}

/** Celebrate / streak — soft glow + tulip + subtle sparkles (no confetti spam / no mascot). */
export function CelebrateArt({ className = 'celebrateArt illustration', ...rest }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 160 100" aria-hidden {...rest}>
      <defs>
        <radialGradient id="cel-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.gold} stopOpacity="0.28" />
          <stop offset="100%" stopColor={C.gold} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="50" r="48" fill="url(#cel-glow)" />
      {/* quiet sparkles — Lucide sparkles spirit, static */}
      {[
        [28, 24], [128, 22], [36, 70], [124, 68],
      ].map(([sx, sy], i) => (
        <path
          key={i}
          transform={`translate(${sx} ${sy})`}
          d="M0-5 L1.2-1.2 L5 0 L1.2 1.2 L0 5 L-1.2 1.2 L-5 0 L-1.2-1.2 Z"
          fill={i % 2 ? C.orange : C.gold}
          opacity="0.85"
        />
      ))}
      <TulipIcon x={52} y={22} scale={1.55} uid="cel-t" />
      <WindmillIcon x={98} y={38} scale={1.1} />
    </svg>
  )
}

/** Onboarding — friendly Dutch motifs welcome (windmill + bike + tulip). */
export function OnboardArt({ className = 'onboardArt illustration', ...rest }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 120 100" aria-hidden {...rest}>
      <ellipse cx="60" cy="90" rx="40" ry="8" fill={C.sky} opacity="0.14" />
      <WindmillIcon x={38} y={8} scale={1.7} />
      <BikeIcon x={8} y={58} scale={1.6} />
      <TulipIcon x={88} y={48} scale={1.05} uid="ob-t" />
    </svg>
  )
}

/** Brand helpers (no mascot). Kept export names for App compatibility. */
export const BRAND_NAME = 'Lichte Klimop'
export const BRAND_BLURB = 'Warm Dutch practice — tulips, bikes, and molens.'
/** @deprecated Prefer BRAND_NAME — kept so older imports do not break mid-HMR */
export const MASCOT_NAME = BRAND_NAME
export const MASCOT_BLURB = BRAND_BLURB
