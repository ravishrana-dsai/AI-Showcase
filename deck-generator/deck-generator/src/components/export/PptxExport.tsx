'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useExport } from '@/hooks/useExport';

export interface PptxExportProps {
  onExport?: () => void;
}

export function PptxExport({ onExport }: PptxExportProps) {
  const { exportPptx, isExporting, exportFormat } = useExport();

  const handleExport = async () => {
    await exportPptx();
    onExport?.();
  };

  return (
    <Button
      onClick={handleExport}
      disabled={isExporting}
      isLoading={isExporting && exportFormat === 'pptx'}
      variant="primary"
      size="md"
    >
      {isExporting && exportFormat === 'pptx' ? (
        'Exporting...'
      ) : (
        <>
          <Download className="w-4 h-4 mr-2" />
          Export PPTX
        </>
      )}
    </Button>
  );
}
