import { UnknownError } from '$lib/errors';

export const useFirstRow = <T>(result: T[]): T | null => (result.length > 0 ? result[0] : null);
export const useFirstRowOrThrow = (customError?: Error) => {
  return <T>(result: T[]) => {
    if (result.length === 0) {
      throw customError ?? new UnknownError();
    }
    return result[0];
  };
};
