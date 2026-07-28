export const validateCpf = (raw) => {
  const cpf = raw.replace(/\D/g, '');

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  return checkDigit(cpf, 9) && checkDigit(cpf, 10);
};

const checkDigit = (cpf, position) => {
  const sum = Array.from({ length: position }, (_, i) =>
    parseInt(cpf[i]) * (position + 1 - i)
  ).reduce((acc, v) => acc + v, 0);

  const remainder = (sum * 10) % 11;
  const digit = remainder >= 10 ? 0 : remainder;

  return digit === parseInt(cpf[position]);
};
