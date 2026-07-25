/**
 * Retry utility for transient errors
 * Unit-testable retry helper with exponential backoff
 */

export function isTransientError(error) {
  if (!error) return false;
  const status = error.status || (error.response && error.response.status);
  if (status === 429 || status === 529) return true;
  if (status >= 500 && status < 600) return true;
  if (!status && (error.message?.includes('network') || error.message?.includes('fetch') || error.code === 'ECONNRESET')) return true;
  return false;
}

export async function withRetry(fn, { maxAttempts = 3, baseDelay = 1000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientError(error) || attempt === maxAttempts) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
