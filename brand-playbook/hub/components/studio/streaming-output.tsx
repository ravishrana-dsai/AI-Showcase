'use client'

import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface StreamingOutputProps {
  content: string
  isStreaming: boolean
}

export function StreamingOutput({ content, isStreaming }: StreamingOutputProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [content, isStreaming])

  if (!content && !isStreaming) return null

  return (
    <div className="relative">
      {isStreaming && (
        <div className="absolute top-3 right-3 flex items-center gap-2 text-xs text-[var(--brand)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-pulse" />
          Writing...
        </div>
      )}
      <div className="prose prose-invert prose-sm max-w-none p-5 bg-secondary rounded-lg border border-border min-h-[200px]
        prose-headings:text-foreground prose-headings:font-semibold
        prose-p:text-foreground/90 prose-p:leading-relaxed
        prose-strong:text-foreground prose-strong:font-semibold
        prose-ul:text-foreground/90 prose-li:text-foreground/90
        prose-code:text-[var(--brand)] prose-code:bg-card prose-code:px-1 prose-code:rounded
        prose-blockquote:border-l-[var(--brand)] prose-blockquote:text-muted-foreground
        prose-a:text-[var(--brand)]
        prose-table:text-foreground/90
        prose-th:text-foreground prose-th:border-border
        prose-td:border-border">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        {isStreaming && <span className="inline-block w-2 h-4 bg-[var(--brand)] ml-0.5 animate-pulse rounded-sm" />}
      </div>
      <div ref={bottomRef} />
    </div>
  )
}
