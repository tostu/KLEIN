export const formatTime = (ms: string | number): string => {
  const msNum = typeof ms === "string" ? parseFloat(ms) : ms;
  if (msNum < 1000) return `${msNum}ms`;
  return `${(msNum / 1000).toFixed(1)}s`;
};
