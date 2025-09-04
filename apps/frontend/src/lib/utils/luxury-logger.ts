export const LuxuryLogger = {
  log: (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [LuxuryLogger - ${level.toUpperCase()}]: ${message}`;

    switch (level) {
      case 'info':
        console.log(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  },
};

// Utility function to safely access metadata properties
export const safeMetadataAccess = <T>(
  obj: unknown,
  property: string,
  fallback: T,
  context?: string,
): T => {
  try {
    if (!obj || typeof obj !== 'object' || !('metadata' in obj)) {
      if (context) {
        // Safe metadata access: context - object or metadata is undefined
      }
      return fallback;
    }

    const metadata = (obj as { metadata?: Record<string, unknown> }).metadata;
    if (!metadata) {
      return fallback;
    }

    const value = metadata[property] as T;
    return value !== undefined && value !== null ? value : fallback;
  } catch (error) {
    if (context) {
      console.warn(`Safe metadata access error in ${context}:`, error);
    }
    return fallback;
  }
};

// Type-safe metadata access for ImageInfo objects
export const getImageMetadata = (
  imageInfo: unknown,
): {
  id: string;
  title: string;
  description: string;
  ticker: string;
  date: string | undefined;
  countdownDate: string | undefined;
  image: string | undefined;
} => {
  if (!imageInfo || typeof imageInfo !== 'object' || !('metadata' in imageInfo)) {
    return {
      id: 'unknown',
      title: 'Unknown Item',
      description: 'No description available',
      ticker: '$UNKNOWN',
      date: undefined,
      countdownDate: undefined,
      image: undefined,
    };
  }

  const metadata = (imageInfo as { metadata?: Record<string, unknown> }).metadata;
  if (!metadata) {
    return {
      id: 'unknown',
      title: 'Unknown Item',
      description: 'No description available',
      ticker: '$UNKNOWN',
      date: undefined,
      countdownDate: undefined,
      image: undefined,
    };
  }

  return {
    id: (metadata.id as string) || 'unknown',
    title: (metadata.title as string) || 'Unknown Item',
    description: (metadata.description as string) || 'No description available',
    ticker: (metadata.ticker as string) || '$UNKNOWN',
    date: metadata.date as string | undefined,
    countdownDate: metadata.countdownDate as string | undefined,
    image: metadata.image as string | undefined,
  };
};
