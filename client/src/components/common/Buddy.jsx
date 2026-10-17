import React from 'react';

/**
 * Squirrel "Buddy" — BooksBuddy Product Guide Mascot
 *
 * Designed in a warm, refined editorial style:
 * - Natural chestnut russet coat with warm ivory chest and belly
 * - Expressive, friendly eyes with clean highlights
 * - Holds or references a deep forest green book with a golden ribbon
 * - Crisp vector SVG: sharp at any scale, lightweight, zero external images
 *
 * Supported states:
 * - 'welcome': Buddy waving happily with an open book
 * - 'pointing': Buddy gently gesturing towards a highlighted feature
 * - 'explaining': Buddy seated thoughtfully holding an open book
 * - 'success': Buddy celebrating with book and subtle sparkle motifs
 * - 'idle': Buddy holding a closed book with a friendly smile
 * - 'floating': Compact avatar head-and-paws for the corner help button
 */
export function Buddy({
  state = 'welcome', // 'welcome' | 'pointing' | 'explaining' | 'success' | 'idle' | 'floating'
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  className = '',
}) {
  const pixelSizes = {
    sm: 48,
    md: 80,
    lg: 120,
    xl: 160,
  };

  const dim = pixelSizes[size] || pixelSizes.md;

  if (state === 'floating') {
    return (
      <svg
        viewBox="0 0 64 64"
        width={dim}
        height={dim}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
        aria-label="Buddy the Squirrel Mascot"
      >
        {/* Soft Circular Base */}
        <circle cx="32" cy="32" r="30" fill="#F4ECE1" stroke="#DDCFC0" strokeWidth="1.5" />

        {/* Tail tip peaking from behind */}
        <path
          d="M48 28C54 22 55 14 50 10C45 6 39 10 40 16"
          stroke="#A85A3C"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />

        {/* Ears */}
        {/* Left Ear */}
        <path d="M22 22C20 13 25 10 27 15L25 24Z" fill="#A85A3C" />
        <path d="M23 20C21.5 15 24.5 13 25.5 16Z" fill="#E8BDB1" />
        {/* Right Ear */}
        <path d="M42 22C44 13 39 10 37 15L39 24Z" fill="#8B452B" />
        <path d="M41 20C42.5 15 39.5 13 38.5 16Z" fill="#E8BDB1" />

        {/* Head */}
        <ellipse cx="32" cy="28" rx="14" ry="12" fill="#A85A3C" />
        {/* Cheeks / Muzzle */}
        <ellipse cx="26" cy="31" rx="6" ry="5" fill="#FAF6EE" />
        <ellipse cx="38" cy="31" rx="6" ry="5" fill="#FAF6EE" />
        <ellipse cx="32" cy="33" rx="5" ry="4" fill="#FAF6EE" />

        {/* Eyes */}
        <circle cx="27" cy="26" r="2.2" fill="#1A1A1A" />
        <circle cx="26.3" cy="25.3" r="0.8" fill="#FFFFFF" />
        <circle cx="37" cy="26" r="2.2" fill="#1A1A1A" />
        <circle cx="36.3" cy="25.3" r="0.8" fill="#FFFFFF" />

        {/* Nose & Smile */}
        <polygon points="32,29.5 30.5,28 33.5,28" fill="#3D1A0D" />
        <path d="M30 32C31 33 33 33 34 32" stroke="#3D1A0D" strokeWidth="1" strokeLinecap="round" fill="none" />

        {/* Mini Book in Paws at bottom */}
        <rect x="20" y="44" width="24" height="15" rx="3" fill="#1B4332" />
        <path d="M22 45H42" stroke="#FAF6EE" strokeWidth="1.5" />
        <path d="M32 44V59" stroke="#D4A373" strokeWidth="1.2" />

        {/* Paws */}
        <circle cx="23" cy="45" r="3" fill="#FAF6EE" stroke="#A85A3C" strokeWidth="1" />
        <circle cx="41" cy="45" r="3" fill="#FAF6EE" stroke="#A85A3C" strokeWidth="1" />
      </svg>
    );
  }

  // Full-body illustrations for welcome, pointing, explaining, success, idle
  return (
    <svg
      viewBox="0 0 120 120"
      width={dim}
      height={dim}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="Buddy the Squirrel Mascot"
    >
      {/* ─── Grand Bushy Tail (Arching behind) ─── */}
      <path
        d="M60 90C85 92 105 82 104 55C103 34 88 18 72 20C65 21 68 30 76 30C90 30 92 50 82 66C74 78 62 82 52 82"
        fill="#A85A3C"
      />
      <path
        d="M72 20C66 21 69 28 75 29C85 30 89 45 80 58C72 70 60 76 52 78"
        stroke="#8B452B"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* ─── Body ─── */}
      <ellipse cx="50" cy="74" rx="18" ry="22" fill="#A85A3C" />
      {/* Warm Cream Chest & Belly */}
      <ellipse cx="46" cy="76" rx="11" ry="16" fill="#FAF6EE" />

      {/* ─── Back Foot ─── */}
      <ellipse cx="60" cy="94" rx="10" ry="5" fill="#8B452B" />
      {/* Front Foot */}
      <ellipse cx="38" cy="95" rx="10" ry="5" fill="#A85A3C" />

      {/* ─── Ears ─── */}
      {/* Left Ear */}
      <path d="M38 34C34 20 42 16 45 23L42 36Z" fill="#A85A3C" />
      <path d="M39 31C36.5 22 41 20 42.5 24Z" fill="#E8BDB1" />
      {/* Right Ear */}
      <path d="M60 34C64 20 56 16 53 23L56 36Z" fill="#8B452B" />
      <path d="M59 31C61.5 22 57 20 55.5 24Z" fill="#E8BDB1" />

      {/* ─── Head ─── */}
      <ellipse cx="48" cy="42" rx="19" ry="16" fill="#A85A3C" />

      {/* Cheeks & Muzzle */}
      <ellipse cx="40" cy="46" rx="8" ry="7" fill="#FAF6EE" />
      <ellipse cx="56" cy="46" rx="8" ry="7" fill="#FAF6EE" />
      <ellipse cx="48" cy="49" rx="7" ry="5" fill="#FAF6EE" />

      {/* Eyes */}
      <ellipse cx="41" cy="40" rx="2.8" ry="3.2" fill="#1A1A1A" />
      <circle cx="40" cy="39" r="1.1" fill="#FFFFFF" />
      <ellipse cx="55" cy="40" rx="2.8" ry="3.2" fill="#1A1A1A" />
      <circle cx="54" cy="39" r="1.1" fill="#FFFFFF" />

      {/* Cute Eyebrows */}
      <path d="M38 35C40 34 43 35 44 36" stroke="#5C2612" strokeWidth="1" strokeLinecap="round" fill="none" />
      <path d="M58 35C56 34 53 35 52 36" stroke="#5C2612" strokeWidth="1" strokeLinecap="round" fill="none" />

      {/* Nose */}
      <polygon points="48,44 46,42 50,42" fill="#3D1A0D" />
      {/* Smile */}
      <path d="M45 47C46.5 49 49.5 49 51 47" stroke="#3D1A0D" strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* ─── State Specific Props & Arms ─── */}
      {state === 'welcome' && (
        <>
          {/* Waving Right Paw */}
          <path d="M62 60C68 52 74 42 72 36C68 36 64 42 60 52" stroke="#A85A3C" strokeWidth="6" strokeLinecap="round" />
          <circle cx="72" cy="36" r="4.5" fill="#FAF6EE" stroke="#A85A3C" strokeWidth="1.2" />

          {/* Left Arm holding open book */}
          <path d="M36 62C28 66 22 72 26 80" stroke="#A85A3C" strokeWidth="5" strokeLinecap="round" />
          {/* Open Book */}
          <path d="M22 68C16 66 10 67 6 70V84C10 82 16 82 22 84V68Z" fill="#F6F1E7" stroke="#DDCFC0" strokeWidth="1" />
          <path d="M22 68C28 66 34 67 38 70V84C34 82 28 82 22 84V68Z" fill="#FAF7F2" stroke="#DDCFC0" strokeWidth="1" />
          <path d="M22 68V84" stroke="#D4A373" strokeWidth="1.2" />
          <circle cx="24" cy="76" r="3" fill="#FAF6EE" stroke="#A85A3C" strokeWidth="1" />
        </>
      )}

      {state === 'pointing' && (
        <>
          {/* Right Arm Pointing Forward/Right */}
          <path d="M60 62C72 58 84 56 94 56" stroke="#A85A3C" strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="95" cy="56" rx="4" ry="3.5" fill="#FAF6EE" stroke="#A85A3C" strokeWidth="1.2" />
          {/* Pointing Index Finger Tip */}
          <path d="M98 56H104" stroke="#FAF6EE" strokeWidth="2.5" strokeLinecap="round" />

          {/* Left Arm holding book under arm */}
          <rect x="22" y="66" width="16" height="22" rx="3" fill="#1B4332" transform="rotate(-15 22 66)" />
          <path d="M22 70L36 66" stroke="#D4A373" strokeWidth="1.2" />
          <circle cx="34" cy="74" r="3.5" fill="#FAF6EE" stroke="#A85A3C" strokeWidth="1" />
        </>
      )}

      {state === 'explaining' && (
        <>
          {/* Round Glasses */}
          <circle cx="41" cy="40" r="4.5" stroke="#D4A373" strokeWidth="1" fill="none" />
          <circle cx="55" cy="40" r="4.5" stroke="#D4A373" strokeWidth="1" fill="none" />
          <path d="M45.5 40H50.5" stroke="#D4A373" strokeWidth="1" />

          {/* Gesturing Right Paw */}
          <path d="M60 64C68 62 76 56 74 50" stroke="#A85A3C" strokeWidth="5" strokeLinecap="round" />
          <circle cx="74" cy="50" r="3.5" fill="#FAF6EE" stroke="#A85A3C" strokeWidth="1" />

          {/* Left Arm holding open book on lap */}
          <rect x="26" y="70" width="28" height="18" rx="2" fill="#1B4332" />
          <path d="M28 72H52" stroke="#FAF6EE" strokeWidth="1.5" />
          <path d="M40 70V88" stroke="#D4A373" strokeWidth="1.2" />
          <circle cx="30" cy="72" r="3" fill="#FAF6EE" />
          <circle cx="50" cy="72" r="3" fill="#FAF6EE" />
        </>
      )}

      {state === 'success' && (
        <>
          {/* Celebrating Arms Up Holding Book Overhead */}
          <path d="M38 56C34 46 36 34 42 26" stroke="#A85A3C" strokeWidth="5" strokeLinecap="round" />
          <path d="M58 56C62 46 60 34 54 26" stroke="#A85A3C" strokeWidth="5" strokeLinecap="round" />
          <rect x="36" y="16" width="24" height="14" rx="2" fill="#1B4332" />
          <path d="M38 18H58" stroke="#FAF6EE" strokeWidth="1.5" />
          <path d="M48 16V30" stroke="#D4A373" strokeWidth="1.2" />

          {/* Golden Sparkles */}
          <path d="M20 30L22 26L24 30L28 32L24 34L22 38L20 34L16 32L20 30Z" fill="#D4A373" />
          <path d="M86 28L88 25L90 28L93 30L90 32L88 35L86 32L83 30L86 28Z" fill="#D4A373" />
          <circle cx="78" cy="18" r="1.5" fill="#C97B63" />
        </>
      )}

      {state === 'idle' && (
        <>
          {/* Both Paws resting warmly on book in front */}
          <rect x="34" y="66" width="28" height="18" rx="3" fill="#1B4332" />
          <path d="M36 68H60" stroke="#FAF6EE" strokeWidth="1.5" />
          <path d="M48 66V84" stroke="#D4A373" strokeWidth="1.2" />
          <circle cx="38" cy="68" r="3" fill="#FAF6EE" stroke="#A85A3C" strokeWidth="1" />
          <circle cx="58" cy="68" r="3" fill="#FAF6EE" stroke="#A85A3C" strokeWidth="1" />
        </>
      )}
    </svg>
  );
}
