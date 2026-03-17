import { useState, useEffect } from 'react';

const styles = {
  input: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box',
  },
};

export default function SearchBar({ onChange }) {
  const [value, setValue] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(value);
    }, 300);
    return () => clearTimeout(timer);
  }, [value, onChange]);

  return (
    <input
      type="text"
      style={styles.input}
      placeholder="Search by keyword, location, mood, ship..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
