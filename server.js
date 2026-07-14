const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://hospital_user:hospital_password@localhost:5432/hospital_db';
const pool = new Pool({ connectionString: DATABASE_URL });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const formatBill = (bill) => ({ ...bill, amount: Number(bill.amount), paidAmount: Number(bill.paidAmount) });

async function initialiseDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patients (
      id SERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, age INTEGER NOT NULL,
      gender VARCHAR(20) NOT NULL, phone VARCHAR(20) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS doctors (
      id SERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, speciality VARCHAR(100) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY, patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id), appointment_date DATE NOT NULL, appointment_time TIME NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bills (
      id SERIAL PRIMARY KEY, patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      description VARCHAR(200) NOT NULL, amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= amount),
      payment_method VARCHAR(50) NOT NULL DEFAULT '', bill_date DATE NOT NULL
    );
  `);
  const { rows: [{ count }] } = await pool.query('SELECT COUNT(*)::int AS count FROM doctors');
  if (count === 0) {
    await pool.query(`INSERT INTO doctors (name, speciality) VALUES
      ('Dr. Meera Iyer', 'Cardiology'), ('Dr. Arjun Patel', 'General Medicine'), ('Dr. Sana Khan', 'Pediatrics')`);
    await pool.query(`INSERT INTO patients (name, age, gender, phone) VALUES
      ('Anita Sharma', 29, 'Female', '9876543210'), ('Rahul Verma', 41, 'Male', '9123456780')`);
    await pool.query(`INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time)
      VALUES (1, 1, '2026-07-20', '10:30')`);
    await pool.query(`INSERT INTO bills (patient_id, description, amount, paid_amount, payment_method, bill_date) VALUES
      (1, 'Cardiology consultation', 1500, 1500, 'UPI', '2026-07-14'),
      (2, 'General consultation', 900, 0, '', '2026-07-14')`);
  }
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', service: 'hospital-management-system', database: 'connected' });
}));
app.get('/api/patients', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name, age, gender, phone FROM patients ORDER BY id');
  res.json(rows);
}));
app.get('/api/doctors', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name, speciality FROM doctors ORDER BY id');
  res.json(rows);
}));
app.get('/api/appointments', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`SELECT id, patient_id AS "patientId", doctor_id AS "doctorId",
    TO_CHAR(appointment_date, 'YYYY-MM-DD') AS date, TO_CHAR(appointment_time, 'HH24:MI') AS time
    FROM appointments ORDER BY appointment_date, appointment_time`);
  res.json(rows);
}));
app.get('/api/bills', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`SELECT id, patient_id AS "patientId", description, amount,
    paid_amount AS "paidAmount", payment_method AS method, TO_CHAR(bill_date, 'YYYY-MM-DD') AS date
    FROM bills ORDER BY bill_date DESC, id DESC`);
  res.json(rows.map(formatBill));
}));
app.get('/api/reports/billing', asyncRoute(async (_req, res) => {
  const { rows: [report] } = await pool.query(`SELECT COALESCE(SUM(amount), 0) AS "totalBilled",
    COALESCE(SUM(paid_amount), 0) AS "totalCollected", COALESCE(SUM(amount - paid_amount), 0) AS outstanding,
    COUNT(*) FILTER (WHERE paid_amount >= amount)::int AS "paidBills",
    COUNT(*) FILTER (WHERE paid_amount < amount)::int AS "pendingBills" FROM bills`);
  res.json({ ...report, totalBilled: Number(report.totalBilled), totalCollected: Number(report.totalCollected), outstanding: Number(report.outstanding) });
}));
app.get('/api/reports/dashboard', asyncRoute(async (_req, res) => {
  const [{ rows: [counts] }, { rows: genders }, { rows: upcomingAppointments }] = await Promise.all([
    pool.query(`SELECT (SELECT COUNT(*) FROM patients)::int AS "totalPatients", (SELECT COUNT(*) FROM doctors)::int AS "totalDoctors",
      (SELECT COUNT(*) FROM appointments)::int AS "totalAppointments", COALESCE((SELECT SUM(paid_amount) FROM bills), 0) AS "totalCollected",
      COALESCE((SELECT SUM(amount - paid_amount) FROM bills), 0) AS outstanding`),
    pool.query('SELECT gender, COUNT(*)::int AS count FROM patients GROUP BY gender'),
    pool.query(`SELECT id, patient_id AS "patientId", doctor_id AS "doctorId", TO_CHAR(appointment_date, 'YYYY-MM-DD') AS date,
      TO_CHAR(appointment_time, 'HH24:MI') AS time FROM appointments ORDER BY appointment_date, appointment_time LIMIT 5`)
  ]);
  const genderCounts = Object.fromEntries(genders.map((row) => [row.gender, row.count]));
  res.json({ ...counts, totalCollected: Number(counts.totalCollected), outstanding: Number(counts.outstanding), genderCounts, upcomingAppointments });
}));

app.post('/api/patients', asyncRoute(async (req, res) => {
  const { name, age, gender, phone } = req.body;
  if (!name || !age || !gender || !phone) return res.status(400).json({ message: 'All patient fields are required.' });
  const { rows: [patient] } = await pool.query('INSERT INTO patients (name, age, gender, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, age, gender, phone', [name, Number(age), gender, phone]);
  res.status(201).json(patient);
}));
app.post('/api/appointments', asyncRoute(async (req, res) => {
  const { patientId, doctorId, date, time } = req.body;
  if (!patientId || !doctorId || !date || !time) return res.status(400).json({ message: 'All appointment fields are required.' });
  const { rows: [appointment] } = await pool.query(`INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time)
    VALUES ($1, $2, $3, $4) RETURNING id, patient_id AS "patientId", doctor_id AS "doctorId", TO_CHAR(appointment_date, 'YYYY-MM-DD') AS date, TO_CHAR(appointment_time, 'HH24:MI') AS time`, [patientId, doctorId, date, time]);
  res.status(201).json(appointment);
}));
app.post('/api/bills', asyncRoute(async (req, res) => {
  const { patientId, description, amount, paidAmount, method, date } = req.body;
  const charge = Number(amount); const payment = Number(paidAmount || 0);
  if (!patientId || !description || !charge || !date) return res.status(400).json({ message: 'Patient, description, amount, and date are required.' });
  if (payment < 0 || payment > charge) return res.status(400).json({ message: 'Paid amount must be between 0 and the bill amount.' });
  const { rows: [bill] } = await pool.query(`INSERT INTO bills (patient_id, description, amount, paid_amount, payment_method, bill_date)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, patient_id AS "patientId", description, amount, paid_amount AS "paidAmount", payment_method AS method, TO_CHAR(bill_date, 'YYYY-MM-DD') AS date`, [patientId, description, charge, payment, payment ? method || 'Cash' : '', date]);
  res.status(201).json(formatBill(bill));
}));

app.delete('/api/patients/:id', asyncRoute(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM patients WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ message: 'Patient not found.' });
  res.status(204).send();
}));
app.delete('/api/appointments/:id', asyncRoute(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM appointments WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ message: 'Appointment not found.' });
  res.status(204).send();
}));
app.delete('/api/bills/:id', asyncRoute(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM bills WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ message: 'Bill not found.' });
  res.status(204).send();
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Database operation failed. Please try again.' });
});

initialiseDatabase().then(() => app.listen(PORT, () => console.log(`Hospital app running at http://localhost:${PORT}`))).catch((error) => {
  console.error('Unable to start. Check that PostgreSQL is running and DATABASE_URL is correct.', error.message);
  process.exit(1);
});
