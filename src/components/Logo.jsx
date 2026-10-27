import React from 'react';

// GaitIQ mark: an insole silhouette with three sensing points — one lit amber as a pressure "hot spot".
// Drawn as inline SVG so it stays crisp at every size and shares the app's colour tokens.
export default function Logo({ size = 36, title = 'GaitIQ' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} className="logo-mark">
      <defs>
        <linearGradient id="gaitiq-tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#17806F" />
          <stop offset="1" stopColor="#0B5A4E" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#gaitiq-tile)" />
      <path
        d="M31.5 8.5c9.6 0 16.3 6.2 16.3 15.6 0 6.6-4.4 9.7-5.3 15.2-.9 5.8 1.7 15.2-10 15.2-8.6 0-10.4-6.8-9.5-12.8.7-5.2-6.3-8.2-6.3-16.4 0-9 6.6-16.8 14.8-16.8Z"
        fill="#F6F2E9"
      />
      <circle cx="26.4" cy="22" r="3.6" fill="#0F6E62" />
      <circle cx="38.6" cy="27.4" r="3.6" fill="#E3902A" />
      <circle cx="32.4" cy="47.6" r="4.6" fill="#0F6E62" />
    </svg>
  );
}
