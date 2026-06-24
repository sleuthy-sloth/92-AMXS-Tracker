import '@testing-library/jest-dom/vitest';

// React 19 act environment — required for @testing-library/react
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
