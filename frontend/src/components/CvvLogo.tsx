import React from 'react';

interface CvvLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CvvLogo: React.FC<CvvLogoProps> = ({ className = '', size = 'md' }) => {
  const scale = size === 'sm' ? 0.75 : size === 'lg' ? 1.25 : 1;

  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      {/* Lotus / Swan with Om Vector Symbol */}
      <svg
        width={56 * scale}
        height={50 * scale}
        viewBox="0 0 120 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Outer lotus petals lineart */}
        <path
          d="M60 12 C60 12 40 38 40 64 C40 78 50 86 60 88 C70 86 80 78 80 64 C80 38 60 12 60 12Z"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          fill="none"
        />
        <path
          d="M40 45 C40 45 22 55 18 72 C15 84 25 90 35 90 C45 90 52 84 56 78"
          stroke="#FFFFFF"
          strokeWidth="3"
          fill="none"
        />
        <path
          d="M80 45 C80 45 98 55 102 72 C105 84 95 90 85 90 C75 90 68 84 64 78"
          stroke="#FFFFFF"
          strokeWidth="3"
          fill="none"
        />
        <path
          d="M25 58 C15 65 8 76 12 88 C16 94 28 94 38 90"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          fill="none"
        />
        <path
          d="M95 58 C105 65 112 76 108 88 C104 94 92 94 82 90"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          fill="none"
        />
        {/* Om ॐ character in the center */}
        <text
          x="60"
          y="62"
          textAnchor="middle"
          fill="#D4AF37"
          fontSize="24"
          fontFamily="serif"
          fontWeight="bold"
        >
          ॐ
        </text>
      </svg>

      {/* Typography from the logo */}
      <div className="flex flex-col text-left">
        <span
          className="font-serif font-semibold tracking-wide leading-tight text-[#DEB887]"
          style={{ fontSize: `${20 * scale}px`, color: '#E5C158' }}
        >
          Chinmaya
        </span>
        <span
          className="font-serif font-semibold tracking-wide leading-tight text-[#DEB887]"
          style={{ fontSize: `${20 * scale}px`, color: '#E5C158' }}
        >
          Vishwa Vidyapeeth
        </span>
        <span
          className="font-sans text-white tracking-wider font-light uppercase"
          style={{ fontSize: `${10 * scale}px`, letterSpacing: '0.08em', marginTop: '2px' }}
        >
          Deemed to be University
        </span>
      </div>
    </div>
  );
};
