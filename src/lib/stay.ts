import type { SubmitFunction } from '$app/forms';

// Bare `use:enhance` navigates to the action URL minus `?/name`, dropping the page's own query (Kit 3).
export const stay: SubmitFunction = () => ({ update }) => update({ navigate: false });
