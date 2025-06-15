"use client";

import React from "react";

const LoadingStyles: React.FC = () => {
  return (
    <style>
      {`
      @keyframes drawElectric {
        from {
          stroke-dashoffset: var(--path-length);
          opacity: 0;
        }
        to {
          stroke-dashoffset: 0;
          opacity: var(--max-opacity, 1);
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: var(--max-opacity, 1);
        }
      }

      @keyframes goldenNeonFlicker {
        0%, 100% {
          filter: drop-shadow(0 0 2px #fff) 
                  drop-shadow(0 0 4px #D0B284)
                  drop-shadow(0 0 6px #D7BF75) 
                  drop-shadow(0 0 8px #D7BF75)
                  drop-shadow(0 0 10px rgba(215, 191, 117, 0.4));
        }
        50% {
          filter: drop-shadow(0 0 3px #fff) 
                  drop-shadow(0 0 6px #D0B284)
                  drop-shadow(0 0 9px #D7BF75) 
                  drop-shadow(0 0 12px #D7BF75)
                  drop-shadow(0 0 15px rgba(215, 191, 117, 0.6));
        }
      }

      @keyframes goldenGlow {
        0%, 100% {
          filter: drop-shadow(0 0 6px #D0B284) 
                  drop-shadow(0 0 12px #D7BF75)
                  drop-shadow(0 0 18px rgba(215, 191, 117, 0.3))
                  drop-shadow(0 0 24px rgba(215, 191, 117, 0.2));
        }
        50% {
          filter: drop-shadow(0 0 8px #D0B284) 
                  drop-shadow(0 0 16px #D7BF75)
                  drop-shadow(0 0 24px rgba(215, 191, 117, 0.4))
                  drop-shadow(0 0 32px rgba(215, 191, 117, 0.3));
        }
      }

      @keyframes slideUpLetter {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes sprayPaint {
        from {
          stroke-dashoffset: var(--text-length);
          fill-opacity: 0;
        }
        to {
          stroke-dashoffset: 0;
          fill-opacity: var(--fill-opacity, 1);
        }
      }

      .neon-path {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0;
      }

      .main-path {
        stroke-dasharray: var(--path-length);
        stroke-dashoffset: var(--path-length);
      }

      .glow-path {
        stroke-dasharray: var(--path-length);
        stroke-dashoffset: var(--path-length);
      }

      .electric-draw .main-path {
        animation:
          drawElectric var(--draw-duration) ease-in-out forwards,
          goldenNeonFlicker var(--flicker-speed) infinite ease-in-out;
      }

      .electric-draw .glow-path {
        animation:
          drawElectric var(--draw-duration) ease-in-out forwards,
          goldenGlow var(--flicker-speed) infinite ease-in-out;
      }

      .electric-fade .main-path {
        animation:
          fadeIn var(--draw-duration) cubic-bezier(0.4, 0, 0.2, 1) forwards,
          goldenNeonFlicker var(--flicker-speed) infinite ease-in-out;
      }

      .electric-fade .glow-path {
        animation:
          fadeIn var(--draw-duration) cubic-bezier(0.4, 0, 0.2, 1) forwards,
          goldenGlow var(--flicker-speed) infinite ease-in-out;
      }

      .neon-container {
        transition: transform 0.1s ease-out;
        transform-style: preserve-3d;
      }

      .neon-text {
        color: #ffffff;
        text-shadow: 
          0 0 2px #fff,
          0 0 4px #D0B284,
          0 0 6px #D7BF75,
          0 0 8px #D7BF75,
          0 0 10px rgba(215, 191, 117, 0.4);
      }

      .neon-text-aces {
        font-family: 'Neue World', serif;
        font-weight: 700;
        font-size: 3.5rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .neon-text-fun {
        font-family: 'Spray Letters', cursive;
        font-weight: 400;
        font-size: 3.5rem;
        letter-spacing: 0.05em;
      }

      .letter {
        display: inline-block;
        opacity: 0;
        transform: translateY(30px);
      }

      .letter.visible {
        animation: slideUpLetter 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }

      .spray-text {
        stroke-dasharray: var(--text-length);
        stroke-dashoffset: var(--text-length);
        fill-opacity: 0;
      }

      .spray-animate {
        animation: sprayPaint 1s ease-out forwards;
      }
      `}
    </style>
  );
};

export default LoadingStyles;
