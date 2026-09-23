import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Original Intersect vector branding.
 * Depicts an abstract 3D quadric surface intersecting an inclined plane,
 * highlighting the exact intersection curve.
 */
export const Logo: React.FC<LogoProps> = ({ size = 28, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="intersect-f-grad" x1="12" y1="8" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" stopOpacity="0.85" />
          <stop stopColor="#2563eb" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="intersect-g-grad" x1="8" y1="34" x2="40" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#94a3b8" stopOpacity="0.65" />
          <stop stopColor="#64748b" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="intersect-curve-grad" x1="14" y1="28" x2="34" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fef08a" />
          <stop stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* Surface F: Cylinder / Curved Quadric Silhouette */}
      <path
        d="M14 12C14 7.5 34 7.5 34 12V36C34 40.5 14 40.5 14 36V12Z"
        fill="url(#intersect-f-grad)"
        stroke="#38bdf8"
        strokeWidth="1.2"
        strokeOpacity="0.5"
      />

      {/* Surface G: Inclined intersecting plane */}
      <path
        d="M6 34L26 40L42 16L22 10L6 34Z"
        fill="url(#intersect-g-grad)"
        stroke="#cbd5e1"
        strokeWidth="1.2"
        strokeOpacity="0.6"
      />

      {/* Intersection Ellipse: Back hidden portion (dashed) */}
      <path
        d="M16 28C18 22 30 18 32 20"
        stroke="#fbbf24"
        strokeWidth="2.4"
        strokeDasharray="2 2"
        strokeOpacity="0.65"
        strokeLinecap="round"
      />

      {/* Intersection Ellipse: Front prominent portion (solid glow) */}
      <path
        d="M32 20C34 22 22 30 16 28"
        stroke="url(#intersect-curve-grad)"
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* Direction Point / Tangent Marker */}
      <circle cx="28" cy="24" r="2" fill="#fff" stroke="#f59e0b" strokeWidth="1.2" />
    </svg>
  );
};
