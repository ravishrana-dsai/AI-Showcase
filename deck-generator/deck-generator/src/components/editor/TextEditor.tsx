'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface TextEditorProps {
  elementId: string;
  currentContent: string;
  placeholder?: {
    label: string;
    maxChars?: number;
  };
  onSave: (content: string) => void;
  onClose: () => void;
}

export default function TextEditor({
  elementId,
  currentContent,
  placeholder,
  onSave,
  onClose,
}: TextEditorProps) {
  const [content, setContent] = useState(currentContent);
  const maxChars = placeholder?.maxChars;

  useEffect(() => {
    setContent(currentContent);
  }, [currentContent]);

  const handleSave = () => {
    onSave(content);
    onClose();
  };

  const handleCancel = () => {
    setContent(currentContent);
    onClose();
  };

  const charCount = content.length;
  const isOverLimit = maxChars ? charCount > maxChars : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl m-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Edit {placeholder?.label || 'Text'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">Element ID: {elementId}</p>
          </div>
          <button
            onClick={handleCancel}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder?.label || 'Enter text...'}
            className={cn(
              'min-h-[200px] font-sans',
              isOverLimit && 'border-red-500 focus:ring-red-500'
            )}
            autoFocus
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {placeholder?.label || 'Text content'}
            </p>
            {maxChars && (
              <p
                className={cn(
                  'text-sm font-medium',
                  isOverLimit ? 'text-red-600' : 'text-gray-500'
                )}
              >
                {charCount} / {maxChars} characters
                {isOverLimit && ' (over limit)'}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isOverLimit}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
