import React from 'react';

interface MoneyUndoMarkProps {
  size?: number;
}

export const MoneyUndoMark: React.FC<MoneyUndoMarkProps> = ({ size = 36 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    aria-hidden="true"
  >
    <rect x="2" y="2" width="44" height="44" rx="14" fill="#6D28D9" />
    <circle cx="25" cy="25" r="10" stroke="white" strokeWidth="2.4" />
    <path d="M25 19v12m3-9.5c-.8-1-2-1.5-3.4-1.5-1.7 0-3 .9-3 2.2 0 3.6 6.9 1.3 6.9 5 0 1.4-1.3 2.3-3.2 2.3-1.6 0-2.9-.6-3.8-1.7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M13 18a15 15 0 0 1 24-3" stroke="#6EE7B7" strokeWidth="3" strokeLinecap="round" />
    <path d="m31.5 11.5 5.7 3.1-4.7 4.4" stroke="#6EE7B7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
