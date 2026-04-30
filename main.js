// ── Active nav link on scroll ──
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('nav a.nav-link');

const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        navLinks.forEach((link) => {
          link.classList.toggle(
            'active',
            link.getAttribute('href') === `#${entry.target.id}`
          );
        });
      }
    });
  },
  { rootMargin: '-40% 0px -55% 0px' }
);
sections.forEach((s) => navObserver.observe(s));


// ── Demo booking calendar ──
const TIMES = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

let currentYear, currentMonth, selectedDate = null, selectedTime = null;

const calDays     = document.getElementById('cal-days');
const calLabel    = document.getElementById('cal-month-label');
const calPrev     = document.getElementById('cal-prev');
const calNext     = document.getElementById('cal-next');
const timeSlotsEl = document.getElementById('time-slots');
const selectedDateLabel = document.getElementById('selected-date-label');
const confirmBtn  = document.getElementById('confirm-btn');
const demoForm    = document.getElementById('demo-form');
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
    btn.textContent = d;
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

function selectDate(date) {
  selectedDate = date;
  selectedTime = null;
  renderCalendar();
  renderTimeSlots();
  updateConfirmButton();
}

function renderTimeSlots() {
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

function selectTime(time) {
  selectedTime = time;
  document.querySelectorAll('.time-slot').forEach((btn) => {
    btn.classList.toggle('selected', btn.textContent === time);
  });
  updateConfirmButton();
}

function updateConfirmButton() {
  confirmBtn.disabled = !(selectedDate && selectedTime);
}

demoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name  = document.getElementById('form-name').value.trim();
  const label = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  confirmDetails.textContent = `${name}, we've got you down for ${label} at ${selectedTime}.`;
  bookingCard.style.display = 'none';
  bookingConf.classList.add('visible');
});

calPrev.addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
});

calNext.addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
});

init();

// ── Demo video mute toggle ──
const demoVideo = document.getElementById('demo-video');
const demoMuteBtn = document.getElementById('demo-video-mute');

if (demoVideo && demoMuteBtn) {
  demoMuteBtn.addEventListener('click', () => {
    demoVideo.muted = !demoVideo.muted;
    const iconName = demoVideo.muted ? 'volume-x' : 'volume-2';
    demoMuteBtn.setAttribute('aria-label', demoVideo.muted ? 'Unmute video' : 'Mute video');
    demoMuteBtn.innerHTML = `<i data-lucide="${iconName}"></i>`;
    if (window.lucide) lucide.createIcons();
  });
}

// ── Lucide icons ──
if (window.lucide) lucide.createIcons();
