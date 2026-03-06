export function randomNumber() {
  return Math.floor((Date.now() + Math.random()) * 1_000)
}
