'use client';

import React from 'react';
import { Download, ExternalLink, FileDown, Presentation } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useExport } from '@/hooks/useExport';

export interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const { exportPptx, exportGoogleSlides, isExporting, exportFormat } = useExport();

  const handlePptxExport = async () => {
    await exportPptx();
    // Optionally close dialog after export starts
    // onClose();
  };

  const handleGoogleSlidesExport = async () => {
    await exportGoogleSlides();
    // Optionally close dialog after export starts
    // onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Deck" size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Choose how you'd like to export your presentation deck.
        </p>

        <div className="grid grid-cols-1 gap-4">
          {/* PPTX Export Option */}
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <FileDown className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  PPTX Download
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download your presentation as a PowerPoint file (.pptx) that you can edit and share.
                </p>
                <Button
                  onClick={handlePptxExport}
                  disabled={isExporting}
                  isLoading={isExporting && exportFormat === 'pptx'}
                  variant="primary"
                  size="md"
                  className="w-full sm:w-auto"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isExporting && exportFormat === 'pptx' ? 'Exporting...' : 'Download PPTX'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Google Slides Export Option */}
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <Presentation className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Google Slides
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Export directly to Google Slides and collaborate with your team in real-time.
                </p>
                <Button
                  onClick={handleGoogleSlidesExport}
                  disabled={isExporting}
                  isLoading={isExporting && exportFormat === 'google-slides'}
                  variant="secondary"
                  size="md"
                  className="w-full sm:w-auto"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {isExporting && exportFormat === 'google-slides' ? 'Exporting...' : 'Export to Google Slides'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Modal>
  );
}
