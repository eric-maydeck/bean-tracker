// "999g" below a kilo, else kg with at most one decimal ("1kg", "1.5kg").
export function formatGrams(g: number): string {
  const r = Math.round(g);
  return r < 1000 ? `${r}g` : `${+(r / 1000).toFixed(1)}kg`;
}

export function formatBag(amount: number, left: number | null | undefined): string {
  return left == null ? formatGrams(amount) : `${formatGrams(amount)} (${formatGrams(left)} left)`;
}
