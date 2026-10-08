/** Id for a remark or question kept inside a visit document. */
export function newItemId(): string {
  return crypto.randomUUID()
}
