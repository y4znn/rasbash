import { e } from './records.js';

// The same home link appears across the firm and its research initiative.
export function wordmark(context) {
  return `<a class="rasbash-wordmark ${e(context)}" href="/" aria-label="RASBASH home">RASBASH</a>`;
}
