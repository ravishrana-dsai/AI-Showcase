'use client';

import React from 'react';
import { useDeckStore } from '@/stores/deck-store';
import type { PresentationPurpose } from '@/types/generation';
import {
  Rocket,
  BarChart3,
  GraduationCap,
  FileText,
  Layout,
} from 'lucide-react';

const purposes: {
  value: PresentationPurpose;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'pitch',
    label: 'Pitch Deck',
    description: 'Startup pitch, investor presentation',
    icon: <Rocket className="h-5 w-5" />,
  },
  {
    value: 'report',
    label: 'Report',
    description: 'Quarterly review, status update',
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    value: 'educational',
    label: 'Educational',
    description: 'Lecture, tutorial, workshop',
    icon: <GraduationCap className="h-5 w-5" />,
  },
  {
    value: 'proposal',
    label: 'Proposal',
    description: 'Project proposal, business case',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    value: 'general',
    label: 'General',
    description: 'General purpose presentation',
    icon: <Layout className="h-5 w-5" />,
  },
];

export default function PurposeSelector() {
  const purpose = useDeckStore((s) => s.purpose);
  const setPurpose = useDeckStore((s) => s.setPurpose);

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">
        Presentation Purpose
      </label>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {purposes.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPurpose(p.value)}
            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-center transition-all ${
              purpose === p.value
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div
              className={`${
                purpose === p.value ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              {p.icon}
            </div>
            <span className="text-[11px] font-semibold leading-tight">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
