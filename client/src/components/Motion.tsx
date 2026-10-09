import { motion } from 'motion/react'
import type { ReactNode } from 'react'

// The one curve and pace everything moves with.
const EASE = [0.2, 0.7, 0.2, 1] as const

// Something that eases up into place as it appears. Give the items of a list
// their index and they arrive one after another; the stagger stops growing
// after a few, so a long list doesn't keep you waiting.
export function Rise({ children, index = 0, className }: { children: ReactNode; index?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.05, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

type BarProps = { percent: number; label: string; delay?: number; className?: string; fill?: string }

// A progress bar that fills to its value when it appears, and glides to the
// new one when the value changes.
export function ProgressBar({ percent, label, delay = 0, className = 'h-1.5', fill = 'bg-fg' }: BarProps) {
  return (
    <div
      className={`overflow-hidden rounded-full bg-cell ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <motion.div
        className={`h-full rounded-full ${fill}`}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.9, delay, ease: EASE }}
      />
    </div>
  )
}
