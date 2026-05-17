import React from 'react';
import { SENTIMENT_COLORS, CONCERN_COLORS } from '../constants';

export function Badge({ label, type }) {
  if (!label) return null;
  const colors = type === 'sentiment' ? SENTIMENT_COLORS : CONCERN_COLORS;
  const c = colors[label] || '#6b7280';
  return (
    <span style={{ background: c + '15', color: c, border: '1px solid ' + c + '35', borderRadius: 6, padding: '3px 11px', fontSize: 12, fontWeight: 700 }}>
      {label}
    </span>
  );
}

function fmtInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.replace(/\*\*/g, '')}</strong> : p
  );
}

function BlockHeading({ text }) {
  const clean = text.replace(/^\d+\.\s*/, '');
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
      {clean}
    </div>
  );
}

function parseBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let current = null;
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('### ')) return;
    const headingMatch = trimmed.match(/^\*\*(.+)\*\*$/);
    if (headingMatch) {
      if (current) blocks.push(current);
      current = { heading: headingMatch[1], lines: [] };
      return;
    }
    if (!current) current = { heading: null, lines: [] };
    if (trimmed !== '---') current.lines.push(trimmed);
  });
  if (current && (current.heading || current.lines.length)) blocks.push(current);
  return blocks;
}

function Block({ block }) {
  const { heading, lines } = block;
  const allBullets = lines.length > 0 && lines.every((l) => l.startsWith('- '));

  if (heading === 'Meeting Details' || heading === 'Snapshot') {
    return (
      <div>
        <BlockHeading text={heading} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', marginTop: 8 }}>
          {lines.map((l, i) => {
            const parts = l.replace(/^- /, '').split(': ');
            return (
              <div key={i} style={{ display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, minWidth: 80 }}>{parts[0]}:</span>
                <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{parts.slice(1).join(': ') || '—'}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (heading === '2. Sentiment') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <BlockHeading text="Sentiment" />
        <Badge label={(lines[0] || '').trim()} type="sentiment" />
      </div>
    );
  }

  if (heading === '3. Concern Level') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <BlockHeading text="Concern Level" />
        <Badge label={(lines[0] || '').trim()} type="concern" />
      </div>
    );
  }

  if (heading === 'Risk Watch') {
    const lvl = (lines.find((l) => /^- level:/i.test(l)) || '').replace(/^- Level:\s*/i, '').trim();
    const reason = (lines.find((l) => /^- reason:/i.test(l)) || '').replace(/^- Reason:\s*/i, '').trim();
    return (
      <div>
        <BlockHeading text="Risk Watch" />
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Badge label={lvl} type="concern" />
          {reason && <span style={{ fontSize: 13, color: '#475569' }}>{reason}</span>}
        </div>
      </div>
    );
  }

  if (allBullets) {
    return (
      <div>
        {heading && <BlockHeading text={heading} />}
        <ul style={{ margin: '8px 0 0 0', padding: 0, listStyle: 'none' }}>
          {lines.map((l, i) => {
            const content = l.replace(/^- /, '');
            const kvMatch = content.match(/^([^:]+):\s*(.+)$/);
            return (
              <li key={i} style={{ display: 'flex', gap: 10, padding: '4px 0', borderBottom: i < lines.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                <span style={{ color: '#94a3b8', marginTop: 2, flexShrink: 0 }}>▸</span>
                <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                  {kvMatch ? <span><strong style={{ color: '#1e293b' }}>{kvMatch[1]}:</strong> {kvMatch[2]}</span> : content}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div>
      {heading && <BlockHeading text={heading} />}
      <p style={{ margin: '6px 0 0 0', fontSize: 13, color: '#334155', lineHeight: 1.75 }}>{lines.join(' ')}</p>
    </div>
  );
}

function Section({ text, label, color, bg, border }) {
  const blocks = parseBlocks(text);
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid ' + border }}>
      <div style={{ background: bg, borderBottom: '1px solid ' + border, padding: '10px 20px' }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: color, letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ background: '#fff', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {blocks.map((block, i) => <Block key={i} block={block} />)}
      </div>
    </div>
  );
}

export function HRBPReport({ text }) {
  if (!text) return null;
  const sec2Idx = text.indexOf('### SECTION 2');
  const sec1Text = sec2Idx > -1 ? text.slice(0, sec2Idx).trim() : text;
  const sec2Text = sec2Idx > -1 ? text.slice(sec2Idx).trim() : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Section text={sec1Text} label="SECTION 1 — MEETING ANALYSIS" color="#1e40af" bg="#eff6ff" border="#bfdbfe" />
      {sec2Text && <Section text={sec2Text} label="SECTION 2 — EMPLOYEE MEMORY CARD" color="#15803d" bg="#f0fdf4" border="#bbf7d0" />}
    </div>
  );
}
