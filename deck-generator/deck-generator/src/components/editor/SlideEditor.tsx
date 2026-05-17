'use client';

import React, { useState, useMemo } from 'react';
import { Edit2, Layout } from 'lucide-react';
import { useDeckStore } from '@/stores/deck-store';
import SlideRenderer from '@/components/preview/SlideRenderer';
import TextEditor from './TextEditor';
import LayoutSwitcher from './LayoutSwitcher';
import ColorPicker from './ColorPicker';
import { getRegistry } from '@/lib/templates/registry';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';

interface SlideEditorProps {
  className?: string;
}

export default function SlideEditor({ className }: SlideEditorProps) {
  const deck = useDeckStore((state) => state.deck);
  const selectedSlideIndex = useDeckStore((state) => state.selectedSlideIndex);
  const updateSlideContent = useDeckStore((state) => state.updateSlideContent);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'elements' | 'layout' | 'colors'>('elements');

  const currentSlide = useMemo(() => {
    if (!deck || selectedSlideIndex < 0 || selectedSlideIndex >= deck.slides.length) {
      return null;
    }
    return deck.slides[selectedSlideIndex];
  }, [deck, selectedSlideIndex]);

  const template = useMemo(() => {
    if (!currentSlide) return null;
    const registry = getRegistry();
    return registry.getById(currentSlide.templateId);
  }, [currentSlide]);

  const colorTheme = deck?.colorTheme;

  if (!deck || !currentSlide || !template || !colorTheme) {
    return (
      <div className={cn('flex items-center justify-center p-12', className)}>
        <div className="text-center">
          <p className="text-gray-500">No slide selected or deck not loaded.</p>
        </div>
      </div>
    );
  }

  const editableElements = template.elements.filter(
    (el) => el.type === 'text' && el.placeholder
  );

  const handleElementClick = (elementId: string) => {
    setEditingElementId(elementId);
  };

  const handleSaveContent = (elementId: string, content: string) => {
    updateSlideContent(selectedSlideIndex, elementId, content);
    setEditingElementId(null);
  };

  const handleLayoutSwitch = (newTemplateId: string) => {
    // Update the slide's template ID
    // Note: This would require a new action in the store, but for now we'll just show a message
    // In a full implementation, you'd add updateSlideTemplate action to the store
    console.log('Switching to template:', newTemplateId);
    // For now, we'll just close the editor or show a message
    alert('Template switching requires store update. This feature will be implemented.');
  };

  const editingElement = editingElementId
    ? template.elements.find((el) => el.id === editingElementId)
    : null;

  const editingContent = editingElementId
    ? currentSlide.content[editingElementId] || ''
    : '';

  return (
    <div className={cn('flex h-full gap-6', className)}>
      {/* Main Preview Area */}
      <div className="flex-1">
        <Card className="h-full p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Slide {selectedSlideIndex + 1}
              </h2>
              <p className="text-sm text-gray-500">{template.name}</p>
            </div>
            <div className="text-sm text-gray-500">
              {editableElements.length} editable elements
            </div>
          </div>

          <div className="relative">
            <SlideRenderer
              template={template}
              content={currentSlide.content}
              colorTheme={colorTheme}
              chartData={currentSlide.chartData}
              interactive={true}
              onElementClick={handleElementClick}
              className="w-full"
            />
          </div>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="w-80 space-y-4">
        <Card className="p-4">
          <Tabs
            tabs={[
              { id: 'elements', label: 'Elements' },
              { id: 'layout', label: 'Layout' },
              { id: 'colors', label: 'Colors' },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as typeof activeTab)}
          />
        </Card>

        {/* Elements Tab */}
        {activeTab === 'elements' && (
          <Card className="p-4">
            <div className="mb-4 flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Editable Elements</h3>
            </div>
            <div className="space-y-2">
              {editableElements.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No editable text elements in this template.
                </p>
              ) : (
                editableElements.map((element) => {
                  const content = currentSlide.content[element.id] || '';
                  const placeholder = element.placeholder;
                  return (
                    <button
                      key={element.id}
                      onClick={() => handleElementClick(element.id)}
                      className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left transition-colors hover:border-blue-500 hover:bg-blue-50"
                    >
                      <div className="mb-1 text-xs font-medium text-gray-600">
                        {placeholder?.label || element.id}
                      </div>
                      <div className="truncate text-sm text-gray-900">
                        {content || (
                          <span className="text-gray-400">Click to edit...</span>
                        )}
                      </div>
                      {placeholder?.maxChars && (
                        <div className="mt-1 text-xs text-gray-500">
                          Max {placeholder.maxChars} chars
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        )}

        {/* Layout Tab */}
        {activeTab === 'layout' && (
          <Card className="p-4">
            <LayoutSwitcher
              currentTemplateId={template.id}
              category={template.category}
              onSwitch={handleLayoutSwitch}
              colorTheme={colorTheme}
            />
          </Card>
        )}

        {/* Colors Tab */}
        {activeTab === 'colors' && (
          <Card className="p-4">
            <ColorPicker />
          </Card>
        )}
      </div>

      {/* Text Editor Modal */}
      {editingElementId && editingElement && (
        <TextEditor
          elementId={editingElementId}
          currentContent={editingContent}
          placeholder={editingElement.placeholder}
          onSave={(content) => handleSaveContent(editingElementId, content)}
          onClose={() => setEditingElementId(null)}
        />
      )}
    </div>
  );
}
