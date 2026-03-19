import { useState, useEffect, useRef } from 'react';

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

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
  },
  wrapper: {
    position: 'relative',
    flex: 1,
  },
  iconWrap: {
    position: 'absolute',
    top: '50%',
    left: '14px',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    height: '52px',
    padding: '10px 14px 10px 44px',
    fontSize: '14px',
    border: '1.5px solid #E5E7EB',
    borderRadius: '10px',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#FFFFFF',
    color: '#111827',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
    fontStyle: 'normal',
  },
  inputFocus: {
    borderColor: '#001B6B',
    boxShadow: '0 0 0 3px rgba(0,27,107,0.08)',
    background: '#FFFFFF',
  },
  submitBtn: {
    position: 'absolute',
    top: '50%',
    right: '12px',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#001B6B',
    fontSize: '18px',
    padding: '4px 6px',
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1,
  },
  smartPill: {
    flexShrink: 0,
    border: '1px solid #E5E7EB',
    background: 'transparent',
    color: '#9CA3AF',
    borderRadius: '100px',
    fontSize: '11px',
    fontWeight: 600,
    padding: '3px 10px',
    cursor: 'pointer',
    lineHeight: 1.6,
    whiteSpace: 'nowrap',
  },
  smartPillActive: {
    background: '#001B6B',
    color: '#FFFFFF',
    borderColor: '#001B6B',
  },
};

export default function SearchBar({
  onChange,
  smartMode = false,
  onSmartModeToggle = () => {},
  onSmartSearch = () => {},
  onClear = () => {},
}) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const prevSmartModeRef = useRef(smartMode);

  // Debounced normal search — skipped in smart mode
  useEffect(() => {
    if (smartMode) return;
    const timer = setTimeout(() => {
      onChange(value);
    }, 300);
    return () => clearTimeout(timer);
  }, [value, onChange, smartMode]);

  // When smart mode turns off → immediately fire normal search with current input
  useEffect(() => {
    if (prevSmartModeRef.current && !smartMode) {
      onChange(valueRef.current);
    }
    prevSmartModeRef.current = smartMode;
  }, [smartMode, onChange]);

  function handleChange(e) {
    const newVal = e.target.value;
    setValue(newVal);
    if (smartMode && newVal === '') {
      onChange('');
      onClear();
    }
  }

  function handleKeyDown(e) {
    if (smartMode && e.key === 'Enter' && value.trim()) {
      onSmartSearch(value.trim());
    }
  }

  function handleSubmit() {
    if (value.trim()) {
      onSmartSearch(value.trim());
    }
  }

  const inputStyle = (() => {
    const base = { ...styles.input };
    if (smartMode) {
      base.borderColor = '#001B6B';
      if (value) base.paddingRight = '40px';
      if (focused) {
        base.boxShadow = '0 0 0 3px rgba(0,27,107,0.08)';
      }
    } else if (focused) {
      Object.assign(base, styles.inputFocus);
    }
    return base;
  })();

  const pillStyle = smartMode
    ? { ...styles.smartPill, ...styles.smartPillActive }
    : styles.smartPill;

  return (
    <div style={styles.row}>
      <div style={styles.wrapper}>
        <div style={styles.iconWrap}>
          <MagnifierIcon color={focused ? ICON_COLOR_FOCUS : ICON_COLOR_REST} />
        </div>
        <input
          type="text"
          className="search-input"
          style={inputStyle}
          placeholder={
            smartMode
              ? "Describe what you're looking for..."
              : 'Search by keyword, location, mood, ship...'
          }
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
        />
        {smartMode && value && (
          <button
            style={styles.submitBtn}
            onClick={handleSubmit}
            aria-label="Submit smart search"
          >
            →
          </button>
        )}
      </div>
      <button
        style={pillStyle}
        onClick={onSmartModeToggle}
        aria-pressed={smartMode}
      >
        ✦ Smart
      </button>
    </div>
  );
}
