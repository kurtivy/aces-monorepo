'use client';

import type React from 'react';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Define a type for the path sets to avoid using `any`
type NeonPathSet = {
  name: string;
  mainPath: {
    path: string;
    strokeWidth: number;
    opacity: number;
    animationDelay: number;
    flickerSpeed: number;
    drawDuration: number;
  };
  glowPath: {
    path: string;
    strokeWidth: number;
    opacity: number;
    animationDelay: number;
    flickerSpeed: number;
    drawDuration: number;
  };
};

type AllPathSets = {
  outerCircle: NeonPathSet | null;
  crown: NeonPathSet | null;
  horizontalLine: NeonPathSet | null;
  smileyFace: NeonPathSet | null;
};

// Pre-defined path lengths to avoid runtime calculations
const PATH_LENGTHS = {
  outerCircle: 2100,
  crown: 1200,
  horizontalLine: 500,
  smileyFace: 1500,
};

export const ElectricLogoIntro = ({
  onComplete,
  onBeforeExit,
}: {
  onComplete: () => void;
  onBeforeExit?: () => void;
}) => {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);
  const [pathData, setPathData] = useState<AllPathSets | null>(null);

  useEffect(() => {
    // This effect runs only on the client side
    const parsePathIntoSubPaths = () => {
      const outerCircle =
        'M191 1.02699C157.858 5.58999 124.414 17.778 98.5 34.736C48.957 67.158 15.117 117.455 3.45899 176C1.23299 187.179 0.681991 193.144 0.253991 210.691C-0.698009 249.777 5.27599 278.173 21.462 311.51C65.758 402.737 164.871 450.636 264.5 428.966C307.667 419.576 350.081 394.546 379.224 361.264C407.316 329.181 424.17 293.566 431.66 250.457C434.187 235.913 434.183 198.567 431.653 183.5C421.302 121.864 387.856 69.847 336.821 36.018C311.008 18.906 286.569 9.07899 254.454 2.89499C245.763 1.22099 238.748 0.717987 220.5 0.458987C207.85 0.278987 194.575 0.533988 191 1.02699Z';
      const crown =
        'M222.044 67.262C223.993 70.143 235.405 87.125 247.403 105C268.177 135.947 272.503 141.955 273.291 140.944C273.481 140.7 279.154 131.95 285.896 121.5C309.229 85.334 322.186 65.496 323.091 64.55C323.637 63.979 324 83.852 324 114.3V165H218H112L112.016 113.75L112.032 62.5L120.766 75.992C149.518 120.409 162.763 140.418 163.577 140.672C164.424 140.935 175.646 124.694 205.994 79.283C212.322 69.813 217.725 62.056 218 62.045C218.275 62.034 220.095 64.381 222.044 67.262Z';
      const horizontalLine = 'M325 207.5V224H218H111V207.5V191H218H325V207.5Z';
      const smileyFace =
        'M97.598 252.5C106.692 289.537 130.281 319.248 163.5 335.504C183.004 345.048 196.869 348.323 218 348.38C233.347 348.421 242.384 347.087 256 342.77C275.218 336.676 291.242 326.854 306.102 312.06C323.557 294.681 335.384 273.126 340.165 249.979L341.4 244H361.745H382.091L381.488 247.75C375.425 285.473 360.933 314.132 334.549 340.58C310.362 364.826 284.247 378.901 250 386.149C241.217 388.008 236.23 388.379 219.5 388.417C198.028 388.466 189.446 387.375 172.264 382.411C119.227 367.089 75.38 323.139 60.613 270.5C58.643 263.478 55 246.551 55 244.42C55 244.001 75.947 243.373 87.444 243.448L95.388 243.5L97.598 252.5Z';
      return { outerCircle, crown, horizontalLine, smileyFace };
    };

    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    // Generate a very subtle variation of the path for the glow effect
    const generateSubtleGlowPath = (pathData: string, seed: number) => {
      if (typeof document === 'undefined' || !pathData || pathData.trim().length === 0)
        return pathData;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      svg.appendChild(path);
      document.body.appendChild(svg);

      const pathLength = path.getTotalLength();
      const numPoints = 40;
      const points = [];

      for (let i = 0; i <= numPoints; i++) {
        const distance = (i / numPoints) * pathLength;
        const point = path.getPointAtLength(distance);

        // Add very subtle variation
        const offsetX = (seededRandom(seed + i * 0.1) - 0.5) * 0.8;
        const offsetY = (seededRandom(seed + i * 0.1 + 1000) - 0.5) * 0.8;

        points.push({
          x: point.x + offsetX,
          y: point.y + offsetY,
        });
      }

      document.body.removeChild(svg);

      // Create a smooth path from the points
      let pathString = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        if (i % 4 === 0 || i === points.length - 1) {
          const prev = points[i - 1];
          const prevPrev = points[Math.max(0, i - 2)];
          const cp1x = prev.x + (prev.x - prevPrev.x) * 0.2;
          const cp1y = prev.y + (prev.y - prevPrev.y) * 0.2;
          const cp2x = points[i].x - (points[i].x - prev.x) * 0.2;
          const cp2y = points[i].y - (points[i].y - prev.y) * 0.2;
          pathString += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i].x} ${points[i].y}`;
        }
      }

      return pathString;
    };

    const logoSubPaths = parsePathIntoSubPaths();

    // Smoother animation durations
    const outerCircleDuration = 1.0; // seconds
    const fadeInDuration = 1.0; // seconds

    const generatePathSet = (
      pathData: string,
      partName: string,
      drawDuration: number,
      isDrawn = false,
    ): NeonPathSet | null => {
      if (!pathData) return null;

      // Only generate subtle variations for the outer circle
      // For inner elements, use the exact same path for both main and glow
      const glowPath =
        partName === 'outerCircle'
          ? generateSubtleGlowPath(pathData, 12345 + partName.length)
          : pathData;

      return {
        name: partName,
        mainPath: {
          path: pathData,
          strokeWidth: 3.0, // Main neon tube
          opacity: 1,
          animationDelay: 0,
          flickerSpeed: 2.5,
          drawDuration: drawDuration,
        },
        glowPath: {
          path: glowPath,
          strokeWidth: 1.2, // Thinner subtle glow
          opacity: 0.4, // Very subtle opacity
          animationDelay: isDrawn ? 0.15 : 0.05,
          flickerSpeed: 3.0,
          drawDuration: isDrawn ? drawDuration + 0.2 : fadeInDuration,
        },
      };
    };

    const allPaths: AllPathSets = {
      // Only the outer circle gets the drawing animation
      outerCircle: generatePathSet(
        logoSubPaths.outerCircle,
        'outerCircle',
        outerCircleDuration,
        true,
      ),
      // Other elements just fade in
      crown: generatePathSet(logoSubPaths.crown, 'crown', fadeInDuration),
      horizontalLine: generatePathSet(
        logoSubPaths.horizontalLine,
        'horizontalLine',
        fadeInDuration,
      ),
      smileyFace: generatePathSet(logoSubPaths.smileyFace, 'smileyFace', fadeInDuration),
    };

    setPathData(allPaths);

    // Smoother, overlapping animation timing
    const phase1Start = 0; // Initial delay for outer circle
    const phase2Start = phase1Start + outerCircleDuration * 1000; // Start inner elements right after outer circle completes

    // Calculate when the inner elements reach full brightness
    // This is phase2Start + fadeInDuration (when fade-in completes)
    const peakBrightnessTime = phase2Start + fadeInDuration * 1000;

    const timers = [
      setTimeout(() => setAnimationPhase(1), phase1Start),
      setTimeout(() => setAnimationPhase(2), phase2Start), // All inner elements fade in at once
      setTimeout(() => {
        // Call onBeforeExit at the peak brightness point
        if (onBeforeExit) {
          onBeforeExit();
        }

        // Start the fade-out transition
        setIsFadingOut(true);
      }, peakBrightnessTime),
    ];

    return () => timers.forEach(clearTimeout);
  }, [onBeforeExit]);

  // Render a placeholder or nothing until paths are generated
  if (!pathData) {
    return null;
  }

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {!isFadingOut && (
        <motion.div
          key="electric-logo"
          className="fixed inset-0 flex items-center justify-center bg-black overflow-hidden z-50 min-h-screen w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        >
          <style jsx>{`
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

            /* Smoother fade-in animation */
            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: var(--max-opacity, 1);
              }
            }

            /* Main path neon glow effect - MODIFIED to not affect opacity */
            @keyframes neonFlicker {
              0%,
              100% {
                filter: drop-shadow(0 0 2px #fff) drop-shadow(0 0 4px #fff)
                  drop-shadow(0 0 6px #d0b264) drop-shadow(0 0 8px rgba(208, 178, 100, 0.7));
              }
              50% {
                filter: drop-shadow(0 0 3px #fff) drop-shadow(0 0 6px #fff)
                  drop-shadow(0 0 9px #d0b264) drop-shadow(0 0 10px rgba(208, 178, 100, 0.9));
              }
            }

            /* Subtle glow flicker - MODIFIED to not affect opacity */
            @keyframes subtleFlicker {
              0%,
              100% {
                filter: drop-shadow(0 0 1px #fff) drop-shadow(0 0 2px rgba(208, 178, 100, 0.3));
              }
              50% {
                filter: drop-shadow(0 0 2px #fff) drop-shadow(0 0 3px rgba(208, 178, 100, 0.4));
              }
            }

            /* Subtle wobble */
            @keyframes subtleWobble {
              0%,
              100% {
                transform: translate(0px, 0px);
              }
              50% {
                transform: translate(0.2px, -0.2px);
              }
            }

            /* Smoother glow pulse */
            @keyframes pulseGlow {
              0%,
              100% {
                opacity: 0.15;
                transform: translate(-50%, -50%) scale(0.97);
              }
              50% {
                opacity: 0.3;
                transform: translate(-50%, -50%) scale(1.03);
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

            /* Drawing animation for outer circle */
            .electric-draw .main-path {
              animation:
                drawElectric var(--draw-duration) ease-in-out forwards,
                neonFlicker var(--flicker-speed) infinite ease-in-out;
            }

            .electric-draw .glow-path {
              animation:
                drawElectric var(--draw-duration) ease-in-out forwards,
                subtleFlicker var(--flicker-speed) infinite ease-in-out,
                subtleWobble 4s infinite ease-in-out;
            }

            /* Smoother fade-in animation for inner elements */
            .electric-fade .main-path {
              animation:
                fadeIn var(--draw-duration) cubic-bezier(0.4, 0, 0.2, 1) forwards,
                neonFlicker var(--flicker-speed) infinite ease-in-out;
            }

            .electric-fade .glow-path {
              animation:
                fadeIn var(--draw-duration) cubic-bezier(0.4, 0, 0.2, 1) forwards,
                subtleFlicker var(--flicker-speed) infinite ease-in-out,
                subtleWobble 4s infinite ease-in-out;
            }

            .glow-effect {
              background: radial-gradient(
                circle,
                rgba(208, 178, 100, 0.12) 0%,
                rgba(208, 178, 100, 0.06) 30%,
                rgba(255, 255, 255, 0.02) 60%,
                transparent 80%
              );
              opacity: 0;
              transition: opacity 0.8s ease-in-out;
            }

            .glow-active {
              animation: pulseGlow 6s ease-in-out infinite;
              opacity: 1;
            }
          `}</style>

          <div className="relative w-[450px] h-[450px] flex items-center justify-center">
            {/* Enhanced background glow with smoother transition */}
            <div
              className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full glow-effect ${
                animationPhase >= 1 ? 'glow-active' : ''
              }`}
            />

            {/* Main SVG Container */}
            <svg
              className="w-full h-full"
              viewBox="-50 -50 534 535"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Render each logo part separately with sequential animation */}

              {/* Outer Circle - with drawing animation */}
              {pathData.outerCircle && (
                <g className={animationPhase >= 1 ? 'electric-draw' : ''}>
                  {/* Main neon tube path */}
                  <path
                    className="neon-path main-path"
                    d={pathData.outerCircle.mainPath.path}
                    stroke="#ffffff"
                    strokeWidth={pathData.outerCircle.mainPath.strokeWidth}
                    opacity={pathData.outerCircle.mainPath.opacity}
                    style={
                      {
                        '--flicker-speed': `${pathData.outerCircle.mainPath.flickerSpeed}s`,
                        '--draw-duration': `${pathData.outerCircle.mainPath.drawDuration}s`,
                        '--path-length': `${PATH_LENGTHS.outerCircle}`,
                        animationDelay: `${pathData.outerCircle.mainPath.animationDelay}s`,
                        '--max-opacity': '1',
                      } as React.CSSProperties
                    }
                  />

                  {/* Subtle glow path */}
                  <path
                    className="neon-path glow-path"
                    d={pathData.outerCircle.glowPath.path}
                    stroke="#D0B264"
                    strokeWidth={pathData.outerCircle.glowPath.strokeWidth}
                    opacity={pathData.outerCircle.glowPath.opacity}
                    style={
                      {
                        '--flicker-speed': `${pathData.outerCircle.glowPath.flickerSpeed}s`,
                        '--draw-duration': `${pathData.outerCircle.glowPath.drawDuration}s`,
                        '--path-length': `${PATH_LENGTHS.outerCircle}`,
                        animationDelay: `${pathData.outerCircle.glowPath.animationDelay}s`,
                        '--base-opacity': `${pathData.outerCircle.glowPath.opacity}`,
                        '--max-opacity': `${pathData.outerCircle.glowPath.opacity * 1.25}`,
                      } as React.CSSProperties
                    }
                  />
                </g>
              )}

              {/* Crown - with fade-in animation */}
              {pathData.crown && (
                <g className={animationPhase >= 2 ? 'electric-fade' : ''}>
                  {/* Main neon tube path */}
                  <path
                    className="neon-path main-path"
                    d={pathData.crown.mainPath.path}
                    stroke="#ffffff"
                    strokeWidth={pathData.crown.mainPath.strokeWidth}
                    opacity={0} // Start with opacity 0
                    style={
                      {
                        '--flicker-speed': `${pathData.crown.mainPath.flickerSpeed}s`,
                        '--draw-duration': `${pathData.crown.mainPath.drawDuration}s`,
                        '--max-opacity': '1',
                      } as React.CSSProperties
                    }
                  />

                  {/* Subtle glow path */}
                  <path
                    className="neon-path glow-path"
                    d={pathData.crown.glowPath.path}
                    stroke="#D0B264"
                    strokeWidth={pathData.crown.glowPath.strokeWidth}
                    opacity={0} // Start with opacity 0
                    style={
                      {
                        '--flicker-speed': `${pathData.crown.glowPath.flickerSpeed}s`,
                        '--draw-duration': `${pathData.crown.glowPath.drawDuration}s`,
                        '--base-opacity': `${pathData.crown.glowPath.opacity}`,
                        '--max-opacity': `${pathData.crown.glowPath.opacity * 1.25}`,
                      } as React.CSSProperties
                    }
                  />
                </g>
              )}

              {/* Horizontal Line - with fade-in animation */}
              {pathData.horizontalLine && (
                <g className={animationPhase >= 2 ? 'electric-fade' : ''}>
                  {/* Main neon tube path */}
                  <path
                    className="neon-path main-path"
                    d={pathData.horizontalLine.mainPath.path}
                    stroke="#ffffff"
                    strokeWidth={pathData.horizontalLine.mainPath.strokeWidth}
                    opacity={0} // Start with opacity 0
                    style={
                      {
                        '--flicker-speed': `${pathData.horizontalLine.mainPath.flickerSpeed}s`,
                        '--draw-duration': `${pathData.horizontalLine.mainPath.drawDuration}s`,
                        '--max-opacity': '1',
                      } as React.CSSProperties
                    }
                  />

                  {/* Subtle glow path */}
                  <path
                    className="neon-path glow-path"
                    d={pathData.horizontalLine.glowPath.path}
                    stroke="#D0B264"
                    strokeWidth={pathData.horizontalLine.glowPath.strokeWidth}
                    opacity={0} // Start with opacity 0
                    style={
                      {
                        '--flicker-speed': `${pathData.horizontalLine.glowPath.flickerSpeed}s`,
                        '--draw-duration': `${pathData.horizontalLine.glowPath.drawDuration}s`,
                        '--base-opacity': `${pathData.horizontalLine.glowPath.opacity}`,
                        '--max-opacity': `${pathData.horizontalLine.glowPath.opacity * 1.25}`,
                      } as React.CSSProperties
                    }
                  />
                </g>
              )}

              {/* Smiley Face - with fade-in animation */}
              {pathData.smileyFace && (
                <g className={animationPhase >= 2 ? 'electric-fade' : ''}>
                  {/* Main neon tube path */}
                  <path
                    className="neon-path main-path"
                    d={pathData.smileyFace.mainPath.path}
                    stroke="#ffffff"
                    strokeWidth={pathData.smileyFace.mainPath.strokeWidth}
                    opacity={0} // Start with opacity 0
                    style={
                      {
                        '--flicker-speed': `${pathData.smileyFace.mainPath.flickerSpeed}s`,
                        '--draw-duration': `${pathData.smileyFace.mainPath.drawDuration}s`,
                        '--max-opacity': '1',
                      } as React.CSSProperties
                    }
                  />

                  {/* Subtle glow path */}
                  <path
                    className="neon-path glow-path"
                    d={pathData.smileyFace.glowPath.path}
                    stroke="#D0B264"
                    strokeWidth={pathData.smileyFace.glowPath.strokeWidth}
                    opacity={0} // Start with opacity 0
                    style={
                      {
                        '--flicker-speed': `${pathData.smileyFace.glowPath.flickerSpeed}s`,
                        '--draw-duration': `${pathData.smileyFace.glowPath.drawDuration}s`,
                        '--base-opacity': `${pathData.smileyFace.glowPath.opacity}`,
                        '--max-opacity': `${pathData.smileyFace.glowPath.opacity * 1.25}`,
                      } as React.CSSProperties
                    }
                  />
                </g>
              )}
            </svg>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
