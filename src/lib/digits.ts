/** Remove tudo que não for dígito (0-9). */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}
