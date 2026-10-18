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
    <path d="M17 17.5h16a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Z" fill="#A78BFA" stroke="white" strokeWidth="1.7" />
    <path d="M14 21h-1a2.5 2.5 0 0 0-2.5 2.5v7A2.5 2.5 0 0 0 13 33h16a2.5 2.5 0 0 0 2.5-2.5V32" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="25" cy="25.5" r="4.5" stroke="white" strokeWidth="1.6" />
    <path d="M18.5 25.5h1m11 0h1" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M12.5 16a15 15 0 0 1 24.2-1.3" stroke="#6EE7B7" strokeWidth="3" strokeLinecap="round" />
    <path d="m31.5 11.5 5.7 3.1-4.7 4.4" stroke="#6EE7B7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
