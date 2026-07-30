import { validateCpf } from '../src/cpf.js';

describe('validateCpf', () => {
  it('accepts a valid CPF with formatting', () => {
    expect(validateCpf('529.982.247-25')).toBe(true);
  });

  it('accepts a valid CPF without formatting', () => {
    expect(validateCpf('52998224725')).toBe(true);
  });

  it('rejects CPF with wrong length', () => {
    expect(validateCpf('123')).toBe(false);
  });

  it('rejects CPF with all same digits', () => {
    expect(validateCpf('111.111.111-11')).toBe(false);
  });

  it('rejects CPF with invalid check digits', () => {
    expect(validateCpf('529.982.247-26')).toBe(false);
  });
});
