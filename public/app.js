let patients = [], doctors = [], appointments = [], bills = [], billingReport = {}, dashboard = {};
const $ = (id) => document.getElementById(id);
const request = async (url, options) => { const response = await fetch(url, options); if (!response.ok) throw new Error((await response.json()).message || 'Something went wrong.'); return response.status === 204 ? null : response.json(); };
const showMessage = (message, good = false) => { $('message').textContent = message; $('message').className = good ? 'success' : ''; setTimeout(() => { $('message').textContent = ''; }, 3000); };
const patientName = (id) => patients.find((p) => p.id === id)?.name || 'Unknown';
const doctorName = (id) => doctors.find((d) => d.id === id)?.name || 'Unknown';
const money = (value) => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function render() {
  const genderCounts = dashboard.genderCounts || {};
  const genderTotal = Math.max(patients.length, 1);
  $('dashboard-metrics').innerHTML = `<div><span>Total patients</span><strong>${dashboard.totalPatients || 0}</strong></div><div><span>Doctors</span><strong>${dashboard.totalDoctors || 0}</strong></div><div><span>Appointments</span><strong>${dashboard.totalAppointments || 0}</strong></div><div><span>Collected</span><strong>${money(dashboard.totalCollected || 0)}</strong></div><div><span>Outstanding</span><strong>${money(dashboard.outstanding || 0)}</strong></div>`;
  $('gender-analysis').innerHTML = ['Female', 'Male', 'Other'].map((gender) => { const count = genderCounts[gender] || 0; return `<div class="analysis-row"><span>${gender}</span><div class="bar"><i style="width:${(count / genderTotal) * 100}%"></i></div><strong>${count}</strong></div>`; }).join('');
  $('upcoming-appointments').innerHTML = (dashboard.upcomingAppointments || []).map((appointment) => `<div class="appointment-item"><strong>${patientName(appointment.patientId)}</strong><br><small>${doctorName(appointment.doctorId)} · ${appointment.date} at ${appointment.time}</small></div>`).join('') || '<p>No upcoming appointments.</p>';
  $('summary').innerHTML = `<div><span>Patients</span><strong>${patients.length}</strong></div><div><span>Doctors</span><strong>${doctors.length}</strong></div><div><span>Appointments</span><strong>${appointments.length}</strong></div>`;
  $('billing-report').innerHTML = `<div><span>Total billed</span><strong>${money(billingReport.totalBilled || 0)}</strong></div><div><span>Payment collected</span><strong>${money(billingReport.totalCollected || 0)}</strong></div><div><span>Outstanding balance</span><strong>${money(billingReport.outstanding || 0)}</strong></div><div><span>Paid bills</span><strong>${billingReport.paidBills || 0}</strong></div><div><span>Pending bills</span><strong>${billingReport.pendingBills || 0}</strong></div>`;
  $('patients').innerHTML = patients.map((p) => `<tr><td>${p.name}</td><td>${p.age}</td><td>${p.gender}</td><td>${p.phone}</td><td><button class="danger" onclick="deletePatient(${p.id})">Delete</button></td></tr>`).join('') || '<tr><td colspan="5">No patients yet.</td></tr>';
  $('appointments').innerHTML = appointments.map((a) => `<tr><td>${patientName(a.patientId)}</td><td>${doctorName(a.doctorId)}</td><td>${a.date}</td><td>${a.time}</td><td><button class="danger" onclick="deleteAppointment(${a.id})">Cancel</button></td></tr>`).join('') || '<tr><td colspan="5">No appointments yet.</td></tr>';
  $('bills').innerHTML = bills.map((bill) => { const balance = bill.amount - bill.paidAmount; const paid = balance <= 0; return `<tr><td>${patientName(bill.patientId)}</td><td>${bill.description}</td><td>${money(bill.amount)}</td><td>${money(bill.paidAmount)}</td><td>${money(balance)}</td><td><span class="status ${paid ? 'paid' : 'pending'}">${paid ? 'Paid' : 'Pending'}</span></td><td>${bill.date}</td><td><button class="danger" onclick="deleteBill(${bill.id})">Delete</button></td></tr>`; }).join('') || '<tr><td colspan="8">No bills yet.</td></tr>';
  const options = '<option value="">Choose patient</option>' + patients.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  $('patientId').innerHTML = options; $('billPatientId').innerHTML = options;
  $('doctorId').innerHTML = '<option value="">Choose doctor</option>' + doctors.map((d) => `<option value="${d.id}">${d.name} - ${d.speciality}</option>`).join('');
}
async function load() { [patients, doctors, appointments, bills, billingReport, dashboard] = await Promise.all(['/api/patients', '/api/doctors', '/api/appointments', '/api/bills', '/api/reports/billing', '/api/reports/dashboard'].map((url) => request(url))); render(); }
window.deletePatient = async (id) => { await request(`/api/patients/${id}`, { method: 'DELETE' }); showMessage('Patient deleted.', true); load(); };
window.deleteAppointment = async (id) => { await request(`/api/appointments/${id}`, { method: 'DELETE' }); showMessage('Appointment cancelled.', true); load(); };
window.deleteBill = async (id) => { await request(`/api/bills/${id}`, { method: 'DELETE' }); showMessage('Bill deleted.', true); load(); };
function postForm(formId, url, success) { $(formId).addEventListener('submit', async (event) => { event.preventDefault(); try { await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); event.target.reset(); showMessage(success, true); load(); } catch (error) { showMessage(error.message); } }); }
postForm('patient-form', '/api/patients', 'Patient added.');
postForm('appointment-form', '/api/appointments', 'Appointment booked.');
postForm('bill-form', '/api/bills', 'Bill created.');
load().catch((error) => showMessage(error.message));
$('global-search').addEventListener('input', (event) => {
  const term = event.target.value.trim().toLowerCase();
  document.querySelectorAll('#patients tr, #appointments tr, #bills tr').forEach((row) => { row.hidden = Boolean(term) && !row.textContent.toLowerCase().includes(term); });
});
