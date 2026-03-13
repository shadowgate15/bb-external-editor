// NOTE: This is how IP's are made
// https://github.com/bitburner-official/bitburner-src/blob/v2.8.1/src/utils/IPAddress.ts
const MAX_PORT_NUMBER = 9_00_71_99_25_47_40991

export function randomNumber() {
  return Math.floor(Math.random() * 1_000_000_000)
}
