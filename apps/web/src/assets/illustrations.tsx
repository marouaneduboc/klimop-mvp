/**
 * Lichte Klimop illustrated asset set — Dutch motifs (tulip, bike, windmill, canal)
 * plus a cute Dutch-lion mascot from Microsoft Fluent Emoji (MIT).
 * Soft flat fills + Lucide-adapted strokes. Calm UI — no confetti spam.
 * See ./ATTRIBUTION.md for licenses.
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


/** Cute cartoon lion face — Microsoft Fluent Emoji Flat "Lion" (MIT). Vendored: icons/lion.svg */
function LionFace({
  x = 0,
  y = 0,
  scale = 1,
}: {
  x?: number
  y?: number
  scale?: number
}) {
  // Paths copied verbatim from icons/lion.svg (viewBox 0 0 32 32).
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M28.66 12.33L29.41 12.7C29.68 12.84 30 12.64 30 12.34V8.41C30 7.5 29.64 6.64 29 6C28.36 5.36 27.49 5 26.59 5H26L26.59 3.23C26.79 2.63 26.34 2 25.7 2H19C18.35 2 17.72 2.21 17.2 2.6C16.48 3.14 16.05 3.97 16 4.86H15.99C15.95 3.97 15.51 3.14 14.79 2.61C14.28 2.21 13.65 2 13 2H6.3C5.66 2 5.21 2.63 5.41 3.23L6 5H5.41C4.51 5 3.64 5.36 3 6C2.36 6.64 2 7.51 2 8.41V12.34C2 12.64 2.32 12.84 2.59 12.7L3.34 12.33C3.62 12.19 3.92 12.32 3.99 12.62C4.04 12.83 3.94 13.03 3.75 13.12L2.75 13.62C2.29 13.85 2 14.32 2 14.84V21.29C2 24.08 3.85 26.53 6.53 27.3L15.41 29.84C15.79 29.95 16.2 29.95 16.59 29.84L25.47 27.3C28.15 26.53 30 24.08 30 21.29V14.84C30 14.33 29.71 13.86 29.25 13.63L28.25 13.13C28.07 13.04 27.97 12.83 28.01 12.63C28.08 12.32 28.39 12.19 28.66 12.33Z" fill="#6D4534"/>
      <path d="M10.425 4C11.493 4.00174 12.4408 4.56132 12.97 5.41C14.66 7.05 17.34 7.05 19.03 5.41C19.5592 4.56131 20.4971 4.00173 21.575 4C21.8297 4.00041 22.0769 4.03238 22.3128 4.09221C23.0803 4.28871 23.7361 4.78551 24.1403 5.44935C24.4131 5.90154 24.57 6.43204 24.57 7C24.57 7.12981 24.5619 7.25754 24.5461 7.38274C24.4495 8.12396 24.0842 8.78154 23.55 9.25L25.85 12.41C26.6 13.44 27 14.69 27 15.96C27 19.3 24.3 22 20.96 22H11.04C7.7 22 5 19.3 5 15.96C5 14.69 5.4 13.44 6.15 12.41L8.45 9.25C7.83 8.7 7.43 7.9 7.43 7C7.43 6.754 7.45943 6.51504 7.51496 6.28642C7.78483 5.19583 8.65496 4.33514 9.74354 4.0785C9.96236 4.02751 10.1905 4.00038 10.425 4Z" fill="#FFB02E"/>
      <path d="M9.31999 8.06C9.21999 8.18 9.12999 8.3 9.03999 8.43C8.65999 8.07 8.42999 7.56 8.42999 7C8.42999 5.9 9.32999 5 10.43 5C11.09 5 11.68 5.32 12.04 5.82C10.99 6.37 10.06 7.13 9.31999 8.05V8.06Z" fill="#D3883E"/>
      <path d="M22.7714 8.17705C22.7411 8.13859 22.7105 8.09977 22.68 8.06001C21.94 7.14001 21.01 6.37001 19.96 5.83001C20.33 5.33001 20.92 5.01001 21.58 5.01001C22.68 5.01001 23.58 5.91001 23.58 7.01001C23.58 7.57001 23.34 8.08001 22.97 8.44001C22.9075 8.34977 22.8402 8.26434 22.7714 8.17705Z" fill="#D3883E"/>
      <path d="M16 27.0001C12.69 27.0001 10 24.3101 10 21.0001V19.4301H22V21.0001C22 24.3101 19.31 27.0001 16 27.0001Z" fill="#F3C07B"/>
      <path d="M19.43 16.86C19.16 16.86 18.9 16.74 18.72 16.54L16.73 14.24C16.34 13.79 15.65 13.79 15.26 14.24L13.27 16.54C13.09 16.75 12.83 16.86 12.56 16.86C11.15 16.86 10 18.01 10 19.43C10 20.85 11.15 22 12.57 22H13.86C14.75 22 15.54 21.54 16 20.85C16.46 21.54 17.25 22 18.14 22H19.43C20.85 22 22 20.85 22 19.43C22 18.01 20.85 16.86 19.43 16.86Z" fill="#FFDEA7"/>
      <path d="M12 16C11.45 16 11 15.55 11 15V14C11 13.45 11.45 13 12 13C12.55 13 13 13.45 13 14V15C13 15.55 12.55 16 12 16Z" fill="#212121"/>
      <path d="M20 16C19.45 16 19 15.55 19 15V14C19 13.45 19.45 13 20 13C20.55 13 21 13.45 21 14V15C21 15.55 20.55 16 20 16Z" fill="#212121"/>
      <path d="M15.44 19.72L13.49 17.77C13.15 17.43 13.39 16.86 13.88 16.86H18.15C18.63 16.86 18.87 17.43 18.53 17.77L16.58 19.72C16.26 20.03 15.75 20.03 15.44 19.72Z" fill="#212121"/>
    </g>
  )
}

/** App logo / brand mark — cute Dutch lion (Fluent Emoji) in a soft cream circle. */
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
      {/* Fluent Emoji lion — Dutch-lion symbolism, calm brand mark */}
      <LionFace x={10} y={10} scale={1.375} />
    </svg>
  )
}

/** Home hero — Dutch lion mascot + canal, bike, windmill, tulips. */
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

      {/* cute Dutch lion mascot (Fluent Emoji) */}
      <LionFace x={52} y={52} scale={1.55} />

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

/** Celebrate / streak — soft glow + Dutch lion mascot + quiet static sparkles (no confetti spam). */
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
      <LionFace x={52} y={18} scale={2.0} />
      <TulipIcon x={118} y={58} scale={0.7} uid="cel-t" />
    </svg>
  )
}

/** Onboarding — cute Dutch lion mascot + soft windmill / tulip accents. */
export function OnboardArt({ className = 'onboardArt illustration', ...rest }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 120 100" aria-hidden {...rest}>
      <ellipse cx="60" cy="90" rx="40" ry="8" fill={C.sky} opacity="0.14" />
      <WindmillIcon x={8} y={18} scale={1.15} />
      <LionFace x={36} y={18} scale={2.15} />
      <TulipIcon x={92} y={52} scale={0.95} uid="ob-t" />
    </svg>
  )
}

/** Brand helpers. Kept export names for App compatibility. */
export const BRAND_NAME = 'Lichte Klimop'
export const BRAND_BLURB = 'Warm Dutch practice — a cute lion, tulips, bikes, and molens.'
/** @deprecated Prefer BRAND_NAME — kept so older imports do not break mid-HMR */
export const MASCOT_NAME = BRAND_NAME
export const MASCOT_BLURB = BRAND_BLURB
