/**
 * Ícones SVG em traço (stroke), mesma linguagem visual da sidebar.
 * Uso: <Icon name="alert" /> — herda cor via currentColor.
 * Tamanho padrão 14px via classe .ico (index.css); sobrescreva com size.
 */
import type { ReactNode } from 'react'
type IconName =
  | 'alert' | 'check' | 'info' | 'x' | 'arrow-right' | 'arrow-left'
  | 'trend-up' | 'trend-down' | 'clock' | 'dot' | 'external'

const PATHS: Record<IconName, ReactNode> = {
  alert: <><path d="M12 3.5 21 19H3L12 3.5Z" /><path d="M12 9.5v4.5M12 17h.01" /></>,
  check: <path d="M4.5 12.5 9.5 17.5 19.5 7" />,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  'arrow-left': <path d="M19 12H5M11 6l-6 6 6 6" />,
  'trend-up': <><path d="M3 17 9.5 10.5 13.5 14.5 21 7" /><path d="M15 7h6v6" /></>,
  'trend-down': <><path d="M3 7l6.5 6.5 4-4L21 17" /><path d="M15 17h6v-6" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  dot: <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
}

export default function Icon({ name, size, className = '', style }: {
  name: IconName; size?: number; className?: string; style?: React.CSSProperties
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`ico ${className}`}
      style={size ? { width: size, height: size, ...style } : style}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

/** Selo quadrado colorido com ícone — usado em insights/alertas */
export function IconBadge({ tone, name }: { tone: 'warn' | 'good' | 'info' | 'danger'; name?: IconName }) {
  const icon: IconName = name ?? (tone === 'warn' ? 'alert' : tone === 'good' ? 'check' : tone === 'danger' ? 'x' : 'info')
  return <span className={`ico-badge ${tone}`}><Icon name={icon} size={15} /></span>
}
