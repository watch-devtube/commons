function flat(arr) {
  return arr.reduce((acc, val) => acc.concat(val), []);
}

export function alwaysArray<T>(something?: T | T[]): T[] {
  if (!something) {
    return [];
  }
  return flat([something]);
}
