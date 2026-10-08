export function cn(...inputs: (string | false | null | undefined)[]): string {
  return inputs.filter((x): x is string => Boolean(x)).join(' ');
}
