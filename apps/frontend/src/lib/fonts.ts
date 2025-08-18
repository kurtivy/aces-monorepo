import { JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
  weight: ['400', '700'],
});

// NeueWorld Font Family (for headings)
export const neueWorld = localFont({
  src: [
    {
      path: '../../public/fonts/NeueWorld-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    // {
    //   path: '../../public/fonts/NeueWorld-ExtendedBold.otf',
    //   weight: '700',
    //   style: 'normal',
    // },
    // {
    //   path: '../../public/fonts/NeueWorld-Ultrabold.otf',
    //   weight: '900',
    //   style: 'normal',
    // },
  ],
  display: 'swap',
  variable: '--font-neue-world',
});

// Proxima Nova Font Family (for body text)
export const proximaNova = localFont({
  src: [
    {
      path: '../../public/fonts/ProximaNova-Light.otf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../public/fonts/ProximaNova-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/ProximaNova-Bold.otf',
      weight: '700',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-proxima-nova',
});

// Logo/Design Fonts
export const braahOne = localFont({
  src: '../../public/fonts/BraahOne-Regular.ttf',
  display: 'swap',
  variable: '--font-braah-one',
  weight: '400',
});

export const sprayLetters = localFont({
  src: '../../public/fonts/Spray-Letters.otf',
  display: 'swap',
  variable: '--font-spray-letters',
  weight: '400',
});

// All font variables combined
export const fontVariables = [
  jetbrainsMono.variable,
  neueWorld.variable,
  proximaNova.variable,
  braahOne.variable,
  sprayLetters.variable,
].join(' ');
