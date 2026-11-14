export function formatMenuName(name) {
  if (typeof name !== 'string') return '';

  return name
    .toLocaleLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_match, separator, letter) => (
      `${separator}${letter.toLocaleUpperCase()}`
    ));
}
