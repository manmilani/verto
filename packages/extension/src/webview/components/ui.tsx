import React from 'react'
import type { DisplayStatusGroup } from '@verto/config'
import { statusGroupColor, statusGroupPillColors } from '../theme.js'
import { OTHER_DISPLAY_STATUS_GROUP, SYSTEM_DONE_DISPLAY_GROUP_LABEL, type PillTone, type StatTone, type TextTone } from '../displayStatusGroup.js'

const TEXT_TONE: Record<TextTone, string> = {
  primary: 'var(--vscode-foreground)',
  secondary: 'var(--vscode-descriptionForeground)',
  tertiary: 'var(--vscode-descriptionForeground)',
  quaternary: 'var(--vscode-disabledForeground)',
}

const PILL_TONE: Record<PillTone, { bg: string; fg: string; border: string }> = {
  success: {
    bg: 'color-mix(in srgb, var(--vscode-charts-green) 22%, transparent)',
    fg: 'var(--vscode-foreground)',
    border: 'color-mix(in srgb, var(--vscode-charts-green) 55%, transparent)',
  },
  warning: {
    bg: 'color-mix(in srgb, var(--vscode-charts-orange) 22%, transparent)',
    fg: 'var(--vscode-foreground)',
    border: 'color-mix(in srgb, var(--vscode-charts-orange) 55%, transparent)',
  },
  info: {
    bg: 'color-mix(in srgb, var(--vscode-charts-blue) 22%, transparent)',
    fg: 'var(--vscode-foreground)',
    border: 'color-mix(in srgb, var(--vscode-charts-blue) 55%, transparent)',
  },
  neutral: {
    bg: 'var(--vscode-editor-background)',
    fg: 'var(--vscode-foreground)',
    border: 'var(--vscode-panel-border)',
  },
  deleted: {
    bg: 'color-mix(in srgb, var(--vscode-charts-red) 18%, transparent)',
    fg: 'var(--vscode-foreground)',
    border: 'color-mix(in srgb, var(--vscode-charts-red) 45%, transparent)',
  },
  danger: {
    bg: 'color-mix(in srgb, var(--vscode-charts-red) 22%, transparent)',
    fg: 'var(--vscode-foreground)',
    border: 'color-mix(in srgb, var(--vscode-charts-red) 55%, transparent)',
  },
}

const STAT_TONE: Record<StatTone, string> = {
  success: 'var(--vscode-charts-green)',
  warning: 'var(--vscode-charts-orange)',
  info: 'var(--vscode-charts-blue)',
  danger: 'var(--vscode-charts-red)',
}

export function H1({ children }: { children: React.ReactNode }) {
  return (
    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--vscode-foreground)', lineHeight: 1.2 }}>
      {children}
    </h1>
  )
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--vscode-foreground)' }}>
      {children}
    </h2>
  )
}

export function Text({
  children,
  tone = 'primary',
  size = 'medium',
  weight,
  italic,
  as: Tag = 'span',
  style,
}: {
  children: React.ReactNode
  tone?: TextTone
  size?: 'small' | 'medium'
  weight?: 'normal' | 'semibold' | 'bold'
  italic?: boolean
  as?: 'span' | 'p'
  style?: React.CSSProperties
}) {
  return (
    <Tag
      style={{
        color: TEXT_TONE[tone],
        fontSize: size === 'small' ? 12 : 13,
        fontWeight: weight === 'bold' ? 700 : weight === 'semibold' ? 600 : 400,
        fontStyle: italic ? 'italic' : undefined,
        margin: Tag === 'p' ? '0 0 8px 0' : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}

export function Stack({
  children,
  gap = 12,
  style,
}: {
  children: React.ReactNode
  gap?: number
  style?: React.CSSProperties
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {children}
    </div>
  )
}

export function Row({
  children,
  gap = 8,
  wrap,
  align = 'center',
  style,
}: {
  children: React.ReactNode
  gap?: number
  wrap?: boolean
  align?: 'center' | 'stretch' | 'flex-start'
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: align,
        gap,
        flexWrap: wrap ? 'wrap' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Grid({
  children,
  columns,
  gap = 16,
}: {
  children: React.ReactNode
  columns: number
  gap?: number
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap,
      }}
    >
      {children}
    </div>
  )
}

export function Spacer() {
  return <div style={{ flex: 1 }} />
}

export function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid var(--vscode-panel-border)', margin: 0 }} />
}

export function Stat({
  value,
  label,
  tone,
}: {
  value: string
  label: string
  tone?: StatTone
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1.1,
          color: tone ? STAT_TONE[tone] : 'var(--vscode-foreground)',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}

export function Pill({
  children,
  tone = 'neutral',
  color,
  active,
  size = 'md',
  multiline = false,
  onClick,
  title,
  style,
}: {
  children: React.ReactNode
  tone?: PillTone
  /** Display-status group colour — overrides tone when set (matches legend / progress bar). */
  color?: string
  active?: boolean
  size?: 'sm' | 'md'
  /** Allow text to wrap inside the pill (for long work-item titles in tables). */
  multiline?: boolean
  onClick?: (e: React.MouseEvent) => void
  title?: string
  style?: React.CSSProperties
}) {
  const colors = color ? statusGroupPillColors(color, active) : PILL_TONE[tone]
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      title={title}
      onClick={onClick}
      style={{
        display: multiline ? 'block' : 'inline-flex',
        alignItems: multiline ? undefined : 'center',
        width: multiline ? '100%' : undefined,
        maxWidth: '100%',
        padding: size === 'sm' ? '2px 8px' : '4px 12px',
        borderRadius: multiline ? 10 : 999,
        fontSize: size === 'sm' ? 11 : 12,
        fontWeight: active ? 600 : 500,
        cursor: onClick ? 'pointer' : undefined,
        border: `1px solid ${colors.border}`,
        background: color ? colors.bg : (active ? colors.bg : 'var(--vscode-editor-background)'),
        color: colors.fg,
        overflow: multiline ? 'visible' : 'hidden',
        textOverflow: multiline ? undefined : 'ellipsis',
        whiteSpace: multiline ? 'normal' : 'nowrap',
        wordBreak: multiline ? 'break-word' : undefined,
        overflowWrap: multiline ? 'anywhere' : undefined,
        textAlign: multiline ? 'left' : undefined,
        lineHeight: multiline ? 1.35 : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}

export function LegendDot({
  label,
  color,
  title,
}: {
  label: string
  color: string
  title?: string
}) {
  return (
    <span title={title} style={{ display: 'inline-flex', cursor: title ? 'help' : undefined }}>
      <Row gap={6}>
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: color,
          flexShrink: 0,
        }}
      />
      <Text size="small" tone="secondary">{label}</Text>
      </Row>
    </span>
  )
}

export function StatusLegend({
  displayStatusGroups,
  displayStatusGroupTooltips = {},
  showOther = false,
  showReadyBorder = false,
}: {
  displayStatusGroups: DisplayStatusGroup[]
  displayStatusGroupTooltips?: Record<string, string>
  showOther?: boolean
  showReadyBorder?: boolean
}) {
  return (
    <Row gap={14} wrap>
      <LegendDot
        label={SYSTEM_DONE_DISPLAY_GROUP_LABEL}
        color={statusGroupColor(0)}
        title={displayStatusGroupTooltips[SYSTEM_DONE_DISPLAY_GROUP_LABEL]}
      />
      {displayStatusGroups.map((g, i) => (
        <LegendDot
          key={g.label}
          label={g.label}
          color={statusGroupColor(i + 1)}
          title={displayStatusGroupTooltips[g.label]}
        />
      ))}
      {showOther && (
        <LegendDot
          label={OTHER_DISPLAY_STATUS_GROUP}
          color={statusGroupColor(-1)}
          title={displayStatusGroupTooltips[OTHER_DISPLAY_STATUS_GROUP]}
        />
      )}
      {showReadyBorder && (
        <Row gap={6}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 4,
              border: '2px solid var(--vscode-focusBorder)',
              flexShrink: 0,
            }}
          />
          <Text size="small" tone="secondary">Ready to start</Text>
        </Row>
      )}
    </Row>
  )
}

export function Callout({
  title,
  tone = 'info',
  children,
}: {
  title: string
  tone?: 'info' | 'success' | 'warning' | 'danger'
  children: React.ReactNode
}) {
  const borderColor =
    tone === 'success' ? 'var(--vscode-charts-green)'
    : tone === 'warning' ? 'var(--vscode-charts-orange)'
    : tone === 'danger' ? 'var(--vscode-charts-red)'
    : 'var(--vscode-charts-blue)'
  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        borderLeftWidth: 4,
        borderRadius: 8,
        padding: '12px 14px',
        background: 'var(--vscode-editor-background)',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--vscode-foreground)', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  )
}

export function BorderedBox({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: 10,
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function DataTableFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: 10,
        background: 'var(--vscode-editor-background)',
        overflow: 'hidden',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

export const dataTableStyle: React.CSSProperties = {
  width: '100%',
  tableLayout: 'fixed',
  borderCollapse: 'collapse',
  fontSize: 12,
}

/**
 * Minimum <col> width for fixed-layout tables. Body cells are often narrower than
 * headers (e.g. "0" vs "In Progress"), so width must be derived from header text.
 */
export function dataTableColWidthForHeader(
  headerLabel: string,
  minRem = 3.25,
): React.CSSProperties {
  const ch = Math.max(headerLabel.length + 2, 5)
  return { width: `max(${minRem}rem, ${ch}ch)` }
}

export const dataTableThStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  color: 'var(--vscode-descriptionForeground)',
  fontWeight: 600,
  borderBottom: '1px solid var(--vscode-panel-border)',
  whiteSpace: 'nowrap',
  background: 'color-mix(in srgb, var(--vscode-editor-inactiveSelectionBackground) 70%, var(--vscode-list-activeSelectionBackground))',
}

export const dataTableThCompactStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
}

export const dataTableTdStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--vscode-panel-border)',
  verticalAlign: 'middle',
}

export const dataTableTdCompactStyle: React.CSSProperties = {
  ...dataTableTdStyle,
  whiteSpace: 'nowrap',
}

export const dataTableTdWrapStyle: React.CSSProperties = {
  ...dataTableTdStyle,
  maxWidth: 0,
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
}

export const dataTableTdWorkItemStyle: React.CSSProperties = {
  ...dataTableTdStyle,
  maxWidth: 0,
  overflow: 'hidden',
  verticalAlign: 'top',
}

export function dataTableRowStyle(isSelected: boolean): React.CSSProperties {
  return {
    cursor: 'pointer',
    background: isSelected
      ? 'color-mix(in srgb, var(--vscode-list-activeSelectionBackground) 28%, var(--vscode-editor-background))'
      : undefined,
    color: isSelected ? 'var(--vscode-foreground)' : undefined,
  }
}

export function StatusDot({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  )
}

const COMPLETION_DOT_COLOR: Record<PillTone, string> = {
  success: 'var(--vscode-charts-green)',
  warning: 'var(--vscode-charts-orange)',
  info: 'var(--vscode-charts-blue)',
  deleted: 'var(--vscode-charts-red)',
  danger: 'var(--vscode-charts-red)',
  neutral: 'var(--vscode-disabledForeground)',
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

export function buildTone(n: number): PillTone {
  if (n >= 0.7) return 'success'
  if (n >= 0.4) return 'warning'
  if (n >= 0.15) return 'info'
  return 'deleted'
}

export function completionDotColor(completion: number): string {
  return COMPLETION_DOT_COLOR[buildTone(completion)]
}

export function rowToneFor(n: number): StatTone | undefined {
  if (n >= 0.7) return 'success'
  if (n >= 0.4) return 'warning'
  if (n >= 0.15) return 'info'
  return 'danger'
}
