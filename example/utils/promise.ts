/** Typeguard for finding promises that were fulfilled in `Promise.allsettled()`. */
export const isFulfilled = <T>(
  input: PromiseSettledResult<T>
): input is PromiseFulfilledResult<T> => input.status === 'fulfilled';
