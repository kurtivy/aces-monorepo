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
