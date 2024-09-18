export const NOOP = () => {};
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
export const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));
