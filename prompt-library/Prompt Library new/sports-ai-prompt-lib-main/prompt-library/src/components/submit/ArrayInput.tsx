'use client';

interface ArrayInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  max?: number;
  error?: string;
}

export default function ArrayInput({ label, values, onChange, placeholder = '', max = 6, error }: ArrayInputProps) {
  const addItem = () => {
    if (values.length < max) {
      onChange([...values, '']);
    }
  };

  const removeItem = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, value: string) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };

  return (
    <div>
      <label className="block text-xs font-medium text-muted mb-1">{label}</label>
      <div className="space-y-2">
        {values.map((val, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={val}
              onChange={(e) => updateItem(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-3 py-2.5 rounded-lg glass text-foreground placeholder:text-muted/50 focus:outline-none input-glow text-sm"
            />
            {values.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="p-2 rounded-lg text-muted hover:text-red-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
      {values.length < max && (
        <button
          type="button"
          onClick={addItem}
          className="mt-2 text-xs text-gradient hover:opacity-80 transition-opacity flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add another
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
