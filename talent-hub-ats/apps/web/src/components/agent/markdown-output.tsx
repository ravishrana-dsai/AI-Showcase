"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface MarkdownOutputProps {
  content: string;
  className?: string;
  streaming?: boolean;
}

export function MarkdownOutput({ content, className, streaming }: MarkdownOutputProps) {
  if (!content) return null;

  if (streaming) {
    return (
      <pre className={cn("text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto font-sans", className)}>
        {content}
      </pre>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:font-semibold prose-headings:text-foreground",
        "prose-p:text-sm prose-p:leading-relaxed prose-p:text-foreground",
        "prose-li:text-sm prose-li:text-foreground",
        "prose-strong:text-foreground prose-strong:font-semibold",
        "prose-em:text-muted-foreground",
        "prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
        "prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground",
        "prose-hr:border-border",
        "[&_.bias-marker]:bg-yellow-100 [&_.bias-marker]:text-yellow-800 [&_.bias-marker]:px-1 [&_.bias-marker]:rounded dark:[&_.bias-marker]:bg-yellow-900/40 dark:[&_.bias-marker]:text-yellow-300",
        className
      )}
    >
      <ReactMarkdown
        components={{
          // Render [BIAS: ...] markers with a highlight style
          p: ({ children }) => {
            const text = String(children);
            if (text.includes("[BIAS:")) {
              return (
                <p>
                  {text.split(/(\[BIAS:[^\]]*\])/g).map((part, i) =>
                    part.startsWith("[BIAS:") ? (
                      <span
                        key={i}
                        className="bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded text-xs font-medium dark:bg-yellow-900/40 dark:text-yellow-300"
                      >
                        {part}
                      </span>
                    ) : (
                      part
                    )
                  )}
                </p>
              );
            }
            return <p>{children}</p>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
