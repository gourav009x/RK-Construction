
import pool from "./db.js";

try {
  const [info] = await pool.query(`
    SELECT
      DATABASE() AS database_name,
      @@hostname AS mysql_host,
      @@port AS mysql_port,
      CURRENT_USER() AS mysql_user
  `);

  const [tables] = await pool.query("SHOW TABLES");

  console.log("DATABASE CONNECTION:");
  console.table(info);

  console.log("TABLES FOUND:");
  console.table(tables);

  const [check] = await pool.query(`
    SELECT COUNT(*) AS total FROM admins
  `);

  console.log("Admins table is accessible!");
  console.log("Admin records:", check[0].total);

} catch (error) {
  console.error("DATABASE ERROR:", error.message);
} finally {
  await pool.end();
}
