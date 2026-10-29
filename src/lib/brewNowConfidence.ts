// Client-safe: the one place the Brew now confidence labels live (the server picks the key, the page shows the label).
export type Confidence = 'high' | 'moderate' | 'low' | 'guess';
export const CONFIDENCE_LABEL: Record<Confidence, string> = { high: 'High confidence', moderate: 'Moderate confidence', low: 'Low confidence', guess: 'Guess' };
