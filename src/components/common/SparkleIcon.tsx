import React from 'react';

interface SparkleIconProps {
  className?: string;
  size?: number;
  color?: string;
}

/**
 * AI "sparkle" glyph used to mark semantic / AI search.
 * Mirrors the portal's SparkleIcon (a single four-point star).
 */
export const SparkleIcon: React.FC<SparkleIconProps> = ({
  className,
  size = 16,
  color = 'currentColor',
}) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2l1.85 5.6a3 3 0 0 0 1.9 1.9L21.35 11.35l-5.6 1.85a3 3 0 0 0-1.9 1.9L12 20.7l-1.85-5.6a3 3 0 0 0-1.9-1.9L2.65 11.35l5.6-1.85a3 3 0 0 0 1.9-1.9L12 2z"
      fill={color}
    />
  </svg>
);

export default SparkleIcon;
