import type { CSSProperties } from 'react'

const STRIP = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]

/** Odometer counter: each digit rolls in from the top. Motion lives in index.css. */
export function AnimatedNumber({ value }: { value: number }) {
  const digits = String(Math.max(0, Math.round(value))).split('')

  return (
    <span className="odometer">
      {digits.map((digit, i) => (
        // Keyed by place value, so gaining a digit (9 -> 10) rolls the ones column
        // instead of remounting every place.
        <span key={digits.length - i} className="odometer-place">
          <span
            className="odometer-strip"
            style={{ '--digit': digit } as CSSProperties}
          >
            {STRIP.map((n) => (
              <span key={n}>{n}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  )
}
