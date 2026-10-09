'use client';

import React from 'react';
import Link from 'next/link';

export default function Logo({ size = 'md', showSubtitle = true, href = '/' }) {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const oneUniFontSize = isSm ? 'text-lg' : isLg ? 'text-3xl' : 'text-2xl';
  const subFontSize = isSm ? 'text-[8px]' : isLg ? 'text-[11px]' : 'text-[9.5px]';

  const logoContent = (
    <div className="flex flex-col items-start cursor-pointer select-none group">
      {/* Main Brand Text: OneUni */}
      <div className="flex items-baseline font-black tracking-tight leading-none">
        {/* 'One' in vibrant green */}
        <span className={`${oneUniFontSize} text-[#22ab59] transition-opacity group-hover:opacity-90`}>
          One
        </span>

        {/* 'Uni' in golden yellow with teardrop/oil drop replacing the dot of 'i' */}
        <span className={`${oneUniFontSize} text-[#e59e0b] inline-flex items-baseline transition-opacity group-hover:opacity-90`}>
          Un
          <span className="inline-flex flex-col items-center justify-end relative">
            {/* Golden Teardrop / Drop shape matching official logo image */}
            <svg
              viewBox="-40 00 160 60"
              className="w-[0.35em] h-[0.52em] fill-[#e59e0b] absolute -top-[0.12em] left-1/2 -translate-x-1/2 pointer-events-none"
            >
              <path d="M50 0 C65 30 100 65 100 95 A50 50 0 1 1 0 95 C0 65 35 30 50 0 Z" />
            </svg>
            {/* Dotless stem of 'i' */}
            <span>ı</span>
          </span>
        </span>
      </div>

      {/* Subtitle: AGRI PLATFORM */}
      {showSubtitle && (
        <span className={`${subFontSize} font-extrabold uppercase text-[#22ab59] tracking-[0.28em] mt-0.5 leading-none group-hover:text-emerald-400 transition-colors`}>
          AGRI PLATFORM
        </span>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{logoContent}</Link>;
  }

  return logoContent;
}
