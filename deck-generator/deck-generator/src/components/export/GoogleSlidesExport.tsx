'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { useExport } from '@/hooks/useExport';

export interface GoogleSlidesExportProps {
  onExport?: () => void;
}

export function GoogleSlidesExport({ onExport }: GoogleSlidesExportProps) {
  const { data: session } = useSession();
  const { exportGoogleSlides, isExporting, exportFormat } = useExport();

  const handleExport = async () => {
    await exportGoogleSlides();
    onExport?.();
  };

  // Show sign-in message if not authenticated
  if (!session) {
    return (
      <div className="text-sm text-gray-600">
        Sign in to export to Google Slides
      </div>
    );
  }

  return (
    <Button
      onClick={handleExport}
      disabled={isExporting}
      isLoading={isExporting && exportFormat === 'google-slides'}
      variant="secondary"
      size="md"
    >
      {isExporting && exportFormat === 'google-slides' ? (
        'Exporting...'
      ) : (
        <>
          <ExternalLink className="w-4 h-4 mr-2" />
          Export to Google Slides
        </>
      )}
    </Button>
  );
}
