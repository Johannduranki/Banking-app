import mariadb, { PoolConnection } from "mariadb";
import { config } from "./config.js";

export const pool = mariadb.createPool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  connectionLimit: 10,
  acquireTimeout: 10000,
  bigIntAsNumber: true
});

export async function inTransaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  let connection: PoolConnection | undefined;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    connection?.release();
  }
}

