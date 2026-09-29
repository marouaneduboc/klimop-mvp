/**
 * Lichte Klimop illustrated asset set — Klimmie mascot + scene art.
 * Soft gradients, multi-layer SVG, cream / orange / green / sky / gold palette.
 */
import type { SVGProps } from 'react'

const C = {
  cream: '#FFF8F0',
  white: '#FFFFFF',
  ink: '#1C2430',
  muted: '#5B6675',
  orange: '#E36A1E',
  green: '#2F9E6B',
  greenDeep: '#1F7A52',
  greenLite: '#5BC48F',
  sky: '#3B82C4',
  skyLite: '#DCEBFA',
  gold: '#F0B429',
  coral: '#D94B4B',
  blush: '#F5A98A',
} as const

type ArtProps = SVGProps<SVGSVGElement> & { title?: string }

/** Shared Klimmie face/body (leafy ivy companion). Pose: idle | wave | cheer | rest | bike */
function KlimmieFigure({
  x = 0,
  y = 0,
  scale = 1,
  pose = 'idle',
  uid = 'km',
}: {
  x?: number
  y?: number
  scale?: number
  pose?: 'idle' | 'wave' | 'cheer' | 'rest' | 'bike'
  uid?: string
}) {
  const armR =
    pose === 'wave' ? 'M58 52c10-14 18-10 22-2' :
    pose === 'cheer' ? 'M58 48c12-18 20-8 18 4' :
    pose === 'rest' ? 'M56 58c8 4 14 8 16 14' :
    'M56 54c10 2 16 10 14 18'
  const armL =
    pose === 'cheer' ? 'M22 48c-12-18-20-8-18 4' :
    pose === 'rest' ? 'M24 58c-8 4-14 8-16 14' :
    'M24 54c-10 2-16 10-14 18'
  const eyeY = pose === 'rest' ? 40 : 38
  const mouth =
    pose === 'cheer' || pose === 'wave'
      ? <path d="M34 48c3 5 9 5 12 0" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round" />
      : pose === 'rest'
      ? <path d="M36 48c2 2 6 2 8 0" fill="none" stroke={C.ink} strokeWidth="1.8" strokeLinecap="round" />
      : <path d="M35 47c2.5 3.5 7.5 3.5 10 0" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round" />

  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className={`klimmieFigure klimmie-${pose}`}>
      <defs>
        <radialGradient id={`${uid}-body`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={C.greenLite} />
          <stop offset="55%" stopColor={C.green} />
          <stop offset="100%" stopColor={C.greenDeep} />
        </radialGradient>
        <radialGradient id={`${uid}-leaf`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#7ED4A8" />
          <stop offset="100%" stopColor={C.green} />
        </radialGradient>
        <linearGradient id={`${uid}-scarf`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F08A45" />
          <stop offset="100%" stopColor={C.orange} />
        </linearGradient>
        <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={C.ink} floodOpacity="0.12" />
        </filter>
      </defs>

      {/* soft ground shadow */}
      <ellipse cx="40" cy="78" rx="28" ry="6" fill={C.sky} opacity="0.12" />

      {/* back leaves */}
      <path d="M18 28c-10-16 2-28 14-24-4 8-2 18-4 24z" fill={`url(#${uid}-leaf)`} opacity="0.9" />
      <path d="M62 28c10-16-2-28-14-24 4 8 2 18 4 24z" fill={`url(#${uid}-leaf)`} opacity="0.9" />

      {/* arms behind-ish for wave/cheer */}
      <path d={armL} fill="none" stroke={C.greenDeep} strokeWidth="5" strokeLinecap="round" />
      <path d={armR} fill="none" stroke={C.greenDeep} strokeWidth="5" strokeLinecap="round" />
      {(pose === 'wave' || pose === 'cheer') && (
        <circle cx={pose === 'wave' ? 82 : 78} cy={pose === 'wave' ? 48 : 34} r="5" fill={`url(#${uid}-body)`} />
      )}
      {pose === 'cheer' && <circle cx="2" cy="34" r="5" fill={`url(#${uid}-body)`} />}

      {/* body */}
      <g filter={`url(#${uid}-soft)`}>
        <ellipse cx="40" cy="48" rx="26" ry="28" fill={`url(#${uid}-body)`} />
        {/* leaf veins / highlight */}
        <path d="M40 24c-2 12-2 24 0 36" fill="none" stroke={C.greenLite} strokeWidth="2" opacity="0.45" />
        <path d="M28 36c8 4 16 4 24 0" fill="none" stroke={C.greenLite} strokeWidth="1.6" opacity="0.35" />
      </g>

      {/* top sprout */}
      <path d="M40 18c0-10 8-14 14-12-6 4-8 8-8 14-2-4-6-6-6-2z" fill={C.greenLite} />
      <circle cx="52" cy="10" r="4" fill={C.gold} />
      <circle cx="53.5" cy="8.5" r="1.2" fill={C.cream} opacity="0.7" />

      {/* scarf (Dutch orange gezellig) */}
      <path d="M22 56c6 8 30 8 36 0-4 10-10 14-18 14s-14-4-18-14z" fill={`url(#${uid}-scarf)`} />
      <path d="M52 58c6 8 10 18 6 24-2-6-6-10-12-12 4-2 6-6 6-12z" fill={C.orange} />

      {/* face */}
      <ellipse cx="32" cy="44" rx="5.5" ry="4" fill={C.blush} opacity="0.55" />
      <ellipse cx="48" cy="44" rx="5.5" ry="4" fill={C.blush} opacity="0.55" />
      {/* eyes */}
      <ellipse cx="32" cy={eyeY} rx="4.2" ry={pose === 'rest' ? 1.6 : 5} fill={C.ink} />
      <ellipse cx="48" cy={eyeY} rx="4.2" ry={pose === 'rest' ? 1.6 : 5} fill={C.ink} />
      {pose !== 'rest' && (
        <>
          <circle cx="33.4" cy={eyeY - 1.6} r="1.4" fill={C.white} />
          <circle cx="49.4" cy={eyeY - 1.6} r="1.4" fill={C.white} />
        </>
      )}
      {mouth}

      {/* tiny feet */}
      <ellipse cx="30" cy="74" rx="7" ry="3.5" fill={C.greenDeep} opacity="0.85" />
      <ellipse cx="50" cy="74" rx="7" ry="3.5" fill={C.greenDeep} opacity="0.85" />
      </g>
    </g>
  )
}

/** App logo / brand mark — Klimmie leaf face compact */
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
        <radialGradient id="mark-body" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#7ED4A8" />
          <stop offset="60%" stopColor={C.green} />
          <stop offset="100%" stopColor={C.greenDeep} />
        </radialGradient>
        <linearGradient id="mark-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.gold} />
          <stop offset="100%" stopColor={C.orange} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={C.cream} />
      <circle cx="32" cy="32" r="28" fill="none" stroke="url(#mark-rim)" strokeWidth="2.5" />
      <ellipse cx="32" cy="34" rx="18" ry="19" fill="url(#mark-body)" />
      <path d="M18 22c-6-10 4-16 10-12-2 5 0 10-2 12z" fill="#5BC48F" />
      <path d="M46 22c6-10-4-16-10-12 2 5 0 10 2 12z" fill="#5BC48F" />
      <path d="M32 14c0-7 6-10 10-8-4 3-5 6-5 10-2-3-5-4-5-2z" fill="#7ED4A8" />
      <circle cx="41" cy="9" r="3" fill={C.gold} />
      <circle cx="26" cy="32" r="3.2" fill={C.ink} />
      <circle cx="38" cy="32" r="3.2" fill={C.ink} />
      <circle cx="27" cy="31" r="1" fill={C.white} />
      <circle cx="39" cy="31" r="1" fill={C.white} />
      <path d="M28 39c2 3 6 3 8 0" fill="none" stroke={C.ink} strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="22" cy="36" rx="3.5" ry="2.2" fill={C.blush} opacity="0.5" />
      <ellipse cx="42" cy="36" rx="3.5" ry="2.2" fill={C.blush} opacity="0.5" />
      <path d="M20 44c4 6 20 6 24 0-3 7-8 10-12 10s-9-3-12-10z" fill={C.orange} opacity="0.95" />
    </svg>
  )
}

/** Home hero — canal, bike, Klimmie waving (Dutch gezellig) */
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
        <filter id="home-sh" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor={C.ink} floodOpacity="0.1" />
        </filter>
      </defs>

      {/* sky */}
      <rect width="240" height="150" rx="18" fill="url(#home-sky)" />
      {/* sun */}
      <circle cx="48" cy="36" r="16" fill={C.gold} opacity="0.95" />
      <circle cx="48" cy="36" r="22" fill={C.gold} opacity="0.18" />
      {/* soft clouds */}
      <ellipse cx="170" cy="28" rx="22" ry="10" fill={C.white} opacity="0.7" />
      <ellipse cx="188" cy="30" rx="14" ry="8" fill={C.white} opacity="0.55" />

      {/* canal water */}
      <path d="M0 108h240v42H0z" fill="url(#home-water)" opacity="0.55" />
      <path d="M0 108c40 8 80-6 120 2s70 6 120-4v12H0z" fill={C.sky} opacity="0.2" />

      {/* canal bank */}
      <rect x="0" y="98" width="240" height="12" fill="#E8D5BC" />

      {/* canal house */}
      <g filter="url(#home-sh)">
        <path d="M148 98 L178 58 L208 98 Z" fill={C.orange} />
        <rect x="154" y="72" width="48" height="36" fill="url(#home-house)" stroke={C.ink} strokeWidth="1.5" />
        <rect x="168" y="84" width="12" height="24" rx="1" fill={C.orange} />
        <rect x="158" y="78" width="10" height="10" rx="1" fill={C.skyLite} stroke={C.sky} strokeWidth="1" />
        <rect x="188" y="78" width="10" height="10" rx="1" fill={C.skyLite} stroke={C.sky} strokeWidth="1" />
      </g>

      {/* bike */}
      <g transform="translate(28 78)" stroke={C.ink} strokeWidth="2.2" fill="none" strokeLinecap="round">
        <circle cx="18" cy="28" r="12" />
        <circle cx="58" cy="28" r="12" />
        <path d="M18 28 L34 12 L50 28 M34 12 L34 4 M30 4h12" />
        <path d="M34 12 L46 12 L58 28" />
        <circle cx="18" cy="28" r="3" fill={C.orange} stroke="none" />
        <circle cx="58" cy="28" r="3" fill={C.orange} stroke="none" />
      </g>

      {/* Klimmie waving */}
      <KlimmieFigure x={95} y={52} scale={0.95} pose="wave" uid="home" />
    </svg>
  )
}

/** Daily practice header — morning sun + Klimmie with book */
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
      {/* open book */}
      <g transform="translate(88 48)">
        <path d="M0 8 L22 0 L22 28 L0 32 Z" fill="url(#daily-book)" stroke={C.ink} strokeWidth="1.4" />
        <path d="M22 0 L44 8 L44 32 L22 28 Z" fill={C.cream} stroke={C.ink} strokeWidth="1.4" />
        <path d="M6 12h10M6 18h8M28 12h10M28 18h8" stroke={C.muted} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        <path d="M22 0v28" stroke={C.orange} strokeWidth="2" />
      </g>
      <KlimmieFigure x={42} y={18} scale={0.72} pose="idle" uid="daily" />
    </svg>
  )
}

/** Progress — climbing vine + rising bars + Klimmie cheering */
export function ProgressHeaderArt({ className = 'progressHeroArt illustration', ...rest }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 260 100" aria-hidden {...rest}>
      <defs>
        <linearGradient id="prog-bar" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={C.orange} />
          <stop offset="100%" stopColor="#F08A45" />
        </linearGradient>
        <linearGradient id="prog-vine" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={C.greenDeep} />
          <stop offset="100%" stopColor={C.greenLite} />
        </linearGradient>
      </defs>
      <ellipse cx="130" cy="92" rx="110" ry="8" fill={C.sky} opacity="0.12" />
      <path d="M24 88h212" stroke={C.sky} strokeWidth="3" opacity="0.3" strokeLinecap="round" />
      {/* bars */}
      {[
        [40, 52], [70, 40], [100, 28], [130, 44], [160, 20], [190, 34],
      ].map(([x, h], i) => (
        <rect key={i} x={x} y={88 - h} width="14" height={h} rx="7" fill="url(#prog-bar)" opacity={0.75 + i * 0.04} />
      ))}
      {/* climbing vine */}
      <path d="M210 88c4-20 14-32 28-40" fill="none" stroke="url(#prog-vine)" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="228" cy="42" rx="10" ry="7" fill={C.green} transform="rotate(-30 228 42)" />
      <ellipse cx="238" cy="52" rx="8" ry="5" fill={C.greenLite} transform="rotate(20 238 52)" />
      <circle cx="242" cy="36" r="4" fill={C.gold} />
      <KlimmieFigure x={145} y={18} scale={0.78} pose="cheer" uid="prog" />
    </svg>
  )
}

/** Empty queue / pause — Klimmie resting under sun */
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
      {/* soft grass tufts */}
      <path d="M30 95c4-10 10-10 12 0M48 95c3-8 8-8 10 0M118 95c4-9 9-9 11 0" fill="none" stroke={C.green} strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      <KlimmieFigure x={50} y={28} scale={0.95} pose="rest" uid="empty" />
    </svg>
  )
}

/** Grammar — notebook with Klimmie peeking */
export function GrammarNotebookArt({ className = 'grammarHeaderArt illustration', ...rest }: ArtProps) {
  return (
    <svg className={className} width="88" height="64" viewBox="0 0 130 95" aria-hidden {...rest}>
      <defs>
        <linearGradient id="gram-cover" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.cream} />
          <stop offset="100%" stopColor="#F2E2CE" />
        </linearGradient>
        <filter id="gram-sh" x="-15%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={C.ink} floodOpacity="0.12" />
        </filter>
      </defs>
      <g filter="url(#gram-sh)">
        <rect x="28" y="18" width="72" height="64" rx="8" fill="url(#gram-cover)" stroke={C.ink} strokeWidth="1.8" />
        <path d="M40 18v64" stroke={C.orange} strokeWidth="4" strokeLinecap="round" />
        <path d="M50 34h40M50 46h40M50 58h26" stroke={C.muted} strokeWidth="2" strokeLinecap="round" opacity="0.45" />
        {/* spiral rings */}
        {[28, 42, 56, 70].map((cy) => (
          <circle key={cy} cx="40" cy={cy} r="3.5" fill="none" stroke={C.sky} strokeWidth="1.5" />
        ))}
      </g>
      {/* Klimmie peeking from behind notebook */}
      <g transform="translate(78 8) scale(0.55)">
        <KlimmieFigure pose="idle" uid="gram" />
      </g>
      <circle cx="108" cy="22" r="5" fill={C.gold} />
    </svg>
  )
}

/** De of Het — polished article tags with Klimmie */
export function DeHetTagsArt({ className = 'deofhetArt illustration', ...rest }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 160 80" aria-hidden {...rest}>
      <defs>
        <filter id="dh-sh" x="-10%" y="-15%" width="120%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.8" floodColor={C.ink} floodOpacity="0.1" />
        </filter>
      </defs>
      <g filter="url(#dh-sh)">
        <rect x="8" y="22" width="56" height="36" rx="18" fill="rgba(227,106,30,0.14)" stroke={C.orange} strokeWidth="2.2" />
        <text x="36" y="46" textAnchor="middle" fontSize="18" fontWeight="800" fill={C.orange} fontFamily="ui-sans-serif,system-ui,sans-serif">de</text>
        <rect x="72" y="22" width="56" height="36" rx="18" fill="rgba(59,130,196,0.14)" stroke={C.sky} strokeWidth="2.2" />
        <text x="100" y="46" textAnchor="middle" fontSize="18" fontWeight="800" fill={C.sky} fontFamily="ui-sans-serif,system-ui,sans-serif">het</text>
      </g>
      <KlimmieFigure x={118} y={8} scale={0.55} pose="wave" uid="dh" />
    </svg>
  )
}

/** Celebrate / streak — Klimmie cheering with sparkles */
export function CelebrateArt({ className = 'celebrateArt illustration', ...rest }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 160 100" aria-hidden {...rest}>
      <defs>
        <radialGradient id="cel-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.gold} stopOpacity="0.35" />
          <stop offset="100%" stopColor={C.gold} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="50" r="48" fill="url(#cel-glow)" />
      {/* sparkles */}
      {[
        [24, 22], [130, 18], [18, 60], [142, 55], [40, 12], [120, 70],
      ].map(([sx, sy], i) => (
        <g key={i} transform={`translate(${sx} ${sy})`} className="celebrateSparkle">
          <path d="M0-6 L1.5-1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5-1.5 Z" fill={i % 2 ? C.orange : C.gold} />
        </g>
      ))}
      <KlimmieFigure x={40} y={12} scale={0.9} pose="cheer" uid="cel" />
    </svg>
  )
}

/** Onboarding — friendly Klimmie wave with presence */
export function OnboardArt({ className = 'onboardArt illustration', ...rest }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 120 100" aria-hidden {...rest}>
      <ellipse cx="60" cy="90" rx="40" ry="8" fill={C.sky} opacity="0.14" />
      <KlimmieFigure x={20} y={8} scale={1} pose="wave" uid="ob" />
    </svg>
  )
}

export const MASCOT_NAME = 'Klimmie'
export const MASCOT_BLURB = 'Klimmie — your friendly ivy companion on Lichte Klimop.'
