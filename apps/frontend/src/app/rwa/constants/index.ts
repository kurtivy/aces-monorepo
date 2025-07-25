import type { Section, ImageData } from '../types/section.types';

export const sections: Section[] = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'token-details', label: 'TOKEN DETAILS' },
  { id: 'manifesto', label: 'PRODUCT MANIFESTO' },
  { id: 'place-bids', label: 'PLACE BIDS' },
  { id: 'chats', label: 'CHATS' },
  { id: 'share', label: 'LINK TO YOUR RICH BUDDY', isModal: true },
  { id: 'delivery', label: 'DELIVERY', isModal: true },
];

// Real images of the pink Porsche 911
export const mockImages: ImageData[] = [
  {
    id: 1,
    src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-XLO1yYFWUAiJQZnkumrWt6GLOfTUV0.jpeg',
    thumbnail:
      'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-XLO1yYFWUAiJQZnkumrWt6GLOfTUV0.jpeg',
    alt: 'Pink Porsche 911 - Front View',
  },
  {
    id: 2,
    src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/2-iUQKqCppRWbXEhOi7KNUK773Kxn7yf.jpeg',
    thumbnail:
      'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/2-iUQKqCppRWbXEhOi7KNUK773Kxn7yf.jpeg',
    alt: 'Pink Porsche 911 - Rear View',
  },
  {
    id: 3,
    src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/3-kdbtDhEzl6RvGU7XFK0PNjQyp5T0x3.jpeg',
    thumbnail:
      'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/3-kdbtDhEzl6RvGU7XFK0PNjQyp5T0x3.jpeg',
    alt: 'Pink Porsche 911 - Side Profile',
  },
  {
    id: 4,
    src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/4-ESnibTIZQDab4L60RSs93vMxg9rOde.jpeg',
    thumbnail:
      'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/4-ESnibTIZQDab4L60RSs93vMxg9rOde.jpeg',
    alt: 'Pink Porsche 911 - Urban Setting',
  },
];
