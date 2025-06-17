'use client';

import React, { useState, useEffect } from 'react';

// Define types for the neon logo
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

const PATH_LENGTHS = {
  outerCircle: 2100,
  crown: 1200,
  horizontalLine: 500,
  smileyFace: 1500,
};

const NeonLogo: React.FC = () => {
  const [animationPhase, setAnimationPhase] = useState(0);
  const [pathData, setPathData] = useState<AllPathSets | null>(null);

  useEffect(() => {
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

    const generatePathSet = (
      pathData: string,
      partName: string,
      drawDuration: number,
      isDrawn = false,
    ): NeonPathSet | null => {
      if (!pathData) return null;

      return {
        name: partName,
        mainPath: {
          path: pathData,
          strokeWidth: 3.0,
          opacity: 1,
          animationDelay: 0,
          flickerSpeed: 2.5,
          drawDuration: drawDuration,
        },
        glowPath: {
          path: pathData,
          strokeWidth: 12.0,
          opacity: 0.4,
          animationDelay: isDrawn ? 0.15 : 0.05,
          flickerSpeed: 3.0,
          drawDuration: isDrawn ? drawDuration + 0.2 : drawDuration,
        },
      };
    };

    const logoSubPaths = parsePathIntoSubPaths();
    const outerCircleDuration = 1.0;
    const fadeInDuration = 1.0;

    const allPaths: AllPathSets = {
      outerCircle: generatePathSet(
        logoSubPaths.outerCircle,
        'outerCircle',
        outerCircleDuration,
        true,
      ),
      crown: generatePathSet(logoSubPaths.crown, 'crown', fadeInDuration),
      horizontalLine: generatePathSet(
        logoSubPaths.horizontalLine,
        'horizontalLine',
        fadeInDuration,
      ),
      smileyFace: generatePathSet(logoSubPaths.smileyFace, 'smileyFace', fadeInDuration),
    };

    setPathData(allPaths);

    // STEP 3 FIX: Use single timer instead of multiple phase timers
    // Start phase 1 immediately, then transition to phase 2 after duration
    setAnimationPhase(1);

    const phaseTransitionTimer = setTimeout(() => {
      setAnimationPhase(2);
    }, outerCircleDuration * 1000);

    return () => clearTimeout(phaseTransitionTimer);
  }, []);

  if (!pathData) return null;

  return (
    <div className="relative w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-[300px] lg:h-[300px] flex items-center justify-center">
      <div className="neon-container">
        <svg
          className="w-full h-full overflow-visible"
          viewBox="-60 -60 554 555"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Reduced filters for less intense neon */}
          <defs>
            <filter id="goldenNeonGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feGaussianBlur stdDeviation="4" result="wideBlur" />
              <feGaussianBlur stdDeviation="8" result="extraWideBlur" />
              <feMerge>
                <feMergeNode in="extraWideBlur" />
                <feMergeNode in="wideBlur" />
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="goldenNeonCore" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.5" result="coreBlur" />
              <feMerge>
                <feMergeNode in="coreBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer Circle */}
          {pathData.outerCircle && (
            <g className={animationPhase >= 1 ? 'electric-draw' : ''}>
              <path
                className="neon-path glow-path"
                d={pathData.outerCircle.glowPath.path}
                stroke="#D7BF75"
                strokeWidth={pathData.outerCircle.glowPath.strokeWidth}
                filter="url(#goldenNeonGlow)"
                style={
                  {
                    '--flicker-speed': `${pathData.outerCircle.glowPath.flickerSpeed}s`,
                    '--draw-duration': `${pathData.outerCircle.glowPath.drawDuration}s`,
                    '--path-length': `${PATH_LENGTHS.outerCircle}`,
                    '--max-opacity': `${pathData.outerCircle.glowPath.opacity}`,
                    animationDelay: `${pathData.outerCircle.glowPath.animationDelay}s`,
                  } as React.CSSProperties
                }
              />
              <path
                className="neon-path main-path"
                d={pathData.outerCircle.mainPath.path}
                stroke="#ffffff"
                strokeWidth={pathData.outerCircle.mainPath.strokeWidth}
                filter="url(#goldenNeonCore)"
                style={
                  {
                    '--flicker-speed': `${pathData.outerCircle.mainPath.flickerSpeed}s`,
                    '--draw-duration': `${pathData.outerCircle.mainPath.drawDuration}s`,
                    '--path-length': `${PATH_LENGTHS.outerCircle}`,
                    '--max-opacity': '1',
                  } as React.CSSProperties
                }
              />
            </g>
          )}

          {/* Crown */}
          {pathData.crown && (
            <g className={animationPhase >= 2 ? 'electric-fade' : ''}>
              <path
                className="neon-path glow-path"
                d={pathData.crown.glowPath.path}
                stroke="#D7BF75"
                strokeWidth={pathData.crown.glowPath.strokeWidth}
                filter="url(#goldenNeonGlow)"
                style={
                  {
                    '--flicker-speed': `${pathData.crown.glowPath.flickerSpeed}s`,
                    '--draw-duration': `${pathData.crown.glowPath.drawDuration}s`,
                    '--max-opacity': `${pathData.crown.glowPath.opacity}`,
                  } as React.CSSProperties
                }
              />
              <path
                className="neon-path main-path"
                d={pathData.crown.mainPath.path}
                stroke="#ffffff"
                strokeWidth={pathData.crown.mainPath.strokeWidth}
                filter="url(#goldenNeonCore)"
                style={
                  {
                    '--flicker-speed': `${pathData.crown.mainPath.flickerSpeed}s`,
                    '--draw-duration': `${pathData.crown.mainPath.drawDuration}s`,
                    '--max-opacity': '1',
                  } as React.CSSProperties
                }
              />
            </g>
          )}

          {/* Horizontal Line */}
          {pathData.horizontalLine && (
            <g className={animationPhase >= 2 ? 'electric-fade' : ''}>
              <path
                className="neon-path glow-path"
                d={pathData.horizontalLine.glowPath.path}
                stroke="#D7BF75"
                strokeWidth={pathData.horizontalLine.glowPath.strokeWidth}
                filter="url(#goldenNeonGlow)"
                style={
                  {
                    '--flicker-speed': `${pathData.horizontalLine.glowPath.flickerSpeed}s`,
                    '--draw-duration': `${pathData.horizontalLine.glowPath.drawDuration}s`,
                    '--max-opacity': `${pathData.horizontalLine.glowPath.opacity}`,
                  } as React.CSSProperties
                }
              />
              <path
                className="neon-path main-path"
                d={pathData.horizontalLine.mainPath.path}
                stroke="#ffffff"
                strokeWidth={pathData.horizontalLine.mainPath.strokeWidth}
                filter="url(#goldenNeonCore)"
                style={
                  {
                    '--flicker-speed': `${pathData.horizontalLine.mainPath.flickerSpeed}s`,
                    '--draw-duration': `${pathData.horizontalLine.mainPath.drawDuration}s`,
                    '--max-opacity': '1',
                  } as React.CSSProperties
                }
              />
            </g>
          )}

          {/* Smiley Face */}
          {pathData.smileyFace && (
            <g className={animationPhase >= 2 ? 'electric-fade' : ''}>
              <path
                className="neon-path glow-path"
                d={pathData.smileyFace.glowPath.path}
                stroke="#D7BF75"
                strokeWidth={pathData.smileyFace.glowPath.strokeWidth}
                filter="url(#goldenNeonGlow)"
                style={
                  {
                    '--flicker-speed': `${pathData.smileyFace.glowPath.flickerSpeed}s`,
                    '--draw-duration': `${pathData.smileyFace.glowPath.drawDuration}s`,
                    '--max-opacity': `${pathData.smileyFace.glowPath.opacity}`,
                  } as React.CSSProperties
                }
              />
              <path
                className="neon-path main-path"
                d={pathData.smileyFace.mainPath.path}
                stroke="#ffffff"
                strokeWidth={pathData.smileyFace.mainPath.strokeWidth}
                filter="url(#goldenNeonCore)"
                style={
                  {
                    '--flicker-speed': `${pathData.smileyFace.mainPath.flickerSpeed}s`,
                    '--draw-duration': `${pathData.smileyFace.mainPath.drawDuration}s`,
                    '--max-opacity': '1',
                  } as React.CSSProperties
                }
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

export default NeonLogo;
