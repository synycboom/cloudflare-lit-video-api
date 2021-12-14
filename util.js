export function addMinutesToNow(minutes) {
  return new Date(new Date().getTime() + minutes * 60000);
}
