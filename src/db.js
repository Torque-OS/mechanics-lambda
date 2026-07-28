import pg from 'pg';

const { Pool } = pg;

let pool;

const getPool = () => {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
};

export const findCustomer = async (cpf) => {
  const digits = cpf.replace(/\D/g, '');
  const result = await getPool().query(
    'SELECT id, cpf, active FROM customers WHERE cpf = $1 LIMIT 1',
    [digits]
  );
  return result.rows[0] ?? null;
};
