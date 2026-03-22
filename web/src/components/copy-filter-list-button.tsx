import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { FILTER_SUBSCRIPTION_LINKS_TEXT } from '@/lib/filter-subscriptions'
import { SITE_COPY } from '@/lib/site-content'

const COPY_FEEDBACK_MS = 2200
const __DEV__ = import.meta.env.DEV

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard unavailable')
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'

  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('Copy failed')
  }
}

type CopyFilterListButtonProps = Omit<ButtonProps, 'children' | 'onClick'>
& {
  idleLabel?: string
}

export const CopyFilterListButton = memo(function CopyFilterListButton({
  className,
  idleLabel,
  variant = 'outline',
  size = 'default',
  ...props
}: CopyFilterListButtonProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleCopy = useCallback(async () => {
    try {
      await copyTextToClipboard(FILTER_SUBSCRIPTION_LINKS_TEXT)
      setCopyStatus('copied')
    } catch (err) {
      if (__DEV__) console.error('Clipboard copy failed:', err)
      setCopyStatus('error')
    }

    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopyStatus('idle'), COPY_FEEDBACK_MS)
  }, [])

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  const label =
    copyStatus === 'copied'
      ? SITE_COPY.categorySection.copyAllCopied
      : copyStatus === 'error'
        ? SITE_COPY.categorySection.copyAllFailed
        : (idleLabel ?? SITE_COPY.categorySection.copyAll)

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={handleCopy}
        {...props}
      >
        {copyStatus === 'copied' ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        {label}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copyStatus !== 'idle' ? label : ''}
      </span>
    </>
  )
})