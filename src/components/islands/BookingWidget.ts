const TIMES = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const FORMSPREE_URL = 'https://formspree.io/f/xnjlkzde';

let currentYear: number, currentMonth: number;
let selectedDate: Date | null = null, selectedTime: string | null = null;

const calDays     = document.getElementById('cal-days');
const calLabel    = document.getElementById('cal-month-label');
const calPrev     = document.getElementById('cal-prev');
const calNext     = document.getElementById('cal-next');
const timeSlotsEl = document.getElementById('time-slots');
const selectedDateLabel = document.getElementById('selected-date-label');
const confirmBtn  = document.getElementById('confirm-btn') as HTMLButtonElement | null;
const demoForm    = document.getElementById('demo-form') as HTMLFormElement | null;
const bookingCard = document.getElementById('booking-card');
const bookingConf = document.getElementById('booking-confirmation');
const confirmDetails = document.getElementById('confirm-details');

function init() {
  const now = new Date();
  currentYear  = now.getFullYear();
  currentMonth = now.getMonth();
  renderCalendar();
}

function renderCalendar() {
  if (!calLabel || !calDays) return;
  calLabel.textContent = `${MONTHS[currentMonth]} ${currentYear}`;

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  calDays.innerHTML = '';

  // Empty cells before the 1st
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('button');
    empty.className = 'cal-day empty';
    empty.disabled = true;
    calDays.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(currentYear, currentMonth, d);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isPast    = date < today;

    const btn = document.createElement('button');
    btn.className = 'cal-day';
    btn.textContent = String(d);
    btn.disabled = isWeekend || isPast;

    const isSelected = selectedDate &&
      selectedDate.getFullYear() === currentYear &&
      selectedDate.getMonth()    === currentMonth &&
      selectedDate.getDate()     === d;

    if (isSelected) btn.classList.add('selected');

    btn.addEventListener('click', () => selectDate(new Date(currentYear, currentMonth, d)));
    calDays.appendChild(btn);
  }
}

function selectDate(date: Date) {
  selectedDate = date;
  selectedTime = null;
  renderCalendar();
  renderTimeSlots();
  updateConfirmButton();
}

function renderTimeSlots() {
  if (!selectedDate || !timeSlotsEl || !selectedDateLabel) return;
  const label = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  selectedDateLabel.textContent = `— ${label}`;

  timeSlotsEl.innerHTML = '';
  TIMES.forEach((t) => {
    const btn = document.createElement('button');
    btn.className = 'time-slot';
    btn.textContent = t;
    btn.addEventListener('click', () => selectTime(t));
    timeSlotsEl.appendChild(btn);
  });
}

function selectTime(time: string) {
  selectedTime = time;
  document.querySelectorAll('.time-slot').forEach((btn) => {
    btn.classList.toggle('selected', btn.textContent === time);
  });
  updateConfirmButton();
}

function updateConfirmButton() {
  if (!confirmBtn) return;
  confirmBtn.disabled = !(selectedDate && selectedTime);
}

if (demoForm) {
  demoForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name  = (document.getElementById('form-name') as HTMLInputElement)?.value.trim() ?? '';
    const email = (document.getElementById('form-email') as HTMLInputElement)?.value.trim() ?? '';
    const note  = (document.getElementById('form-note') as HTMLTextAreaElement)?.value.trim() ?? '';
    const label = selectedDate
      ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : '';

    if (!confirmBtn) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Sending…';

    try {
      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          requested_date: label,
          requested_time: selectedTime,
          note: note || '—',
          _subject: `Demo request from ${name} — ${label} at ${selectedTime}`,
        }),
      });

      if (!res.ok) throw new Error('submission failed');

      if (confirmDetails) {
        confirmDetails.textContent = `${name}, we've got you down for ${label} at ${selectedTime}.`;
      }
      if (bookingCard) bookingCard.style.display = 'none';
      if (bookingConf) bookingConf.classList.add('visible');
    } catch {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm Booking';
      alert('Something went wrong — please try again or email us at demos@useverdevision.com');
    }
  });
}

if (calPrev) {
  calPrev.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });
}

if (calNext) {
  calNext.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });
}

init();
