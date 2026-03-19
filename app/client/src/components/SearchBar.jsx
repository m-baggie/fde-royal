import { useState, useEffect } from 'react';

const ICON_COLOR_REST = '#9CA3AF';
const ICON_COLOR_FOCUS = '#001B6B';

function MagnifierIcon({ color }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="8.5" cy="8.5" r="5.5" stroke={color} strokeWidth="1.8" />
      <line x1="12.5" y1="12.5" x2="17" y2="17" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function SearchBar({ onChange }) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => onChange(value), 300);
    return () => clearTimeout(timer);
  }, [value, onChange]);

  const inputStyle = {
    width: '100%',
    height: '52px',
    padding: '10px 14px 10px 44px',
    fontSize: '14px',
    border: focused ? '1.5px solid #001B6B' : '1.5px solid #E5E7EB',
    borderRadius: '10px',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#FFFFFF',
    color: '#111827',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
    boxShadow: focused ? '0 0 0 3px rgba(0,27,107,0.08)' : 'none',
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'absolute', top: '50%', left: '14px', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
        <MagnifierIcon color={focused ? ICON_COLOR_FOCUS : ICON_COLOR_REST} />
      </div>
      <input
        type="text"
        className="search-input"
        style={inputStyle}
        placeholder="Search by keyword, location, mood, ship..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}
