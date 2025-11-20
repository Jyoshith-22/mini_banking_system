const API = '/api'; // same origin

function saveToken(token){ localStorage.setItem('mini_bank_token', token); }
function getToken(){ return localStorage.getItem('mini_bank_token'); }
function authHeaders(){ return { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + getToken() }; }

// small UI helper
function showMessage(msg, type='info', timeout=4000){
  let el = document.getElementById('appMessage');
  if(!el){
    el = document.createElement('div');
    el.id = 'appMessage';
    el.style.position = 'fixed';
    el.style.right = '12px';
    el.style.bottom = '12px';
    el.style.zIndex = 9999;
    el.style.maxWidth = '320px';
    document.body.appendChild(el);
  }
  el.innerText = msg;
  el.style.background = type === 'error' ? '#FEE2E2' : '#ECFCCB';
  el.style.color = '#111';
  el.style.padding = '12px';
  el.style.borderRadius = '8px';
  el.style.boxShadow = '0 6px 18px rgba(18,24,40,0.06)';
  if(timeout) setTimeout(()=>{ if(el) el.remove(); }, timeout);
}

async function parseResponse(res){
  let body;
  try { body = await res.json(); } catch(e){ body = null; }
  return { ok: res.ok, body, status: res.status };
}

// ===== updated login/register block =====
if (document.getElementById('loginForm')) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginBtn = loginForm.querySelector('button[type="submit"]');
  const regBtn = registerForm.querySelector('button[type="submit"]');

  async function handleSubmit(formType) {
    try {
      if (formType === 'login') {
        loginBtn.disabled = true;
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        if (!email || !password) { showMessage('Enter email and password', 'error'); return; }
        const res = await fetch(API + '/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        // DEBUG: read text to avoid JSON parse errors and log it
        const raw = await res.text();
        console.log('LOGIN raw response:', raw);
        let body;
        try { body = JSON.parse(raw); } catch (e) { body = null; }

        if (res.ok && body && body.token) {
          saveToken(body.token);
          window.location.href = '/dashboard.html';
        } else {
          const msg = body?.error || (body?.errors && body.errors.map(x => x.msg).join(', ')) || raw || 'Login failed';
          showMessage(msg, 'error');
        }
      } else {
        regBtn.disabled = true;
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        if (!name || !email || password.length < 6) { showMessage('Please provide name, valid email and password >= 6 chars', 'error'); return; }

        const res = await fetch(API + '/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });

        const raw = await res.text();
        console.log('REGISTER raw response:', raw);
        let body;
        try { body = JSON.parse(raw); } catch (e) { body = null; }

        if (res.ok && body && body.token) {
          // registration created token — save and go to dashboard
          saveToken(body.token);
          window.location.href = '/dashboard.html';
        } else {
          const msg = body?.error || (body?.errors && body.errors.map(x => x.msg).join(', ')) || raw || 'Registration failed';
          showMessage(msg, 'error');
        }
      }
    } catch (err) {
      console.error('Auth fetch error', err);
      showMessage('Network or server error', 'error');
    } finally {
      // re-enable buttons
      try { loginBtn.disabled = false; } catch(e) {}
      try { regBtn.disabled = false; } catch(e) {}
    }
  }

  loginForm.addEventListener('submit', (e) => { e.preventDefault(); handleSubmit('login'); });
  registerForm.addEventListener('submit', (e) => { e.preventDefault(); handleSubmit('register'); });
}
// ===== end updated login/register block =====

if (document.getElementById('balanceValue')){
  async function loadProfile(){
    const res = await fetch(API + '/users/me', { headers: authHeaders() });
    if (!res.ok){ showMessage('Session expired. Redirecting...', 'error'); localStorage.removeItem('mini_bank_token'); setTimeout(()=>window.location.href='/',1200); return; }
    const profile = await res.json();
    document.getElementById('balanceValue').innerText = parseFloat(profile.balance).toFixed(2);
    const userEl = document.getElementById('userIdDisplay');
    if(userEl) userEl.innerText = `Your user id: ${profile.id}`;
  }

  async function loadHistory(){
    const res = await fetch(API + '/transactions/history', { headers: authHeaders() });
    const data = await res.json();
    const ul = document.getElementById('txList'); ul.innerHTML = '';
    data.forEach(tx => {
      const li = document.createElement('li');
      const d = new Date(tx.created_at);
      li.innerText = `${d.toLocaleString()} | ${tx.type} | ${parseFloat(tx.amount).toFixed(2)}${tx.counterparty ? ' | cp: ' + tx.counterparty : ''}`;
      ul.appendChild(li);
    });
  }

  document.getElementById('depositBtn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('amount').value);
    if (!amount || amount <= 0) return showMessage('Enter amount > 0', 'error');
    const res = await fetch(API + '/transactions/deposit', { method:'POST', headers: authHeaders(), body: JSON.stringify({amount}) });
    const {ok, body} = await parseResponse(res);
    if (ok){ await loadProfile(); await loadHistory(); showMessage('Deposit successful'); } else showMessage(body?.error || 'Deposit failed', 'error');
  });

  document.getElementById('withdrawBtn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('amount').value);
    if (!amount || amount <= 0) return showMessage('Enter amount > 0', 'error');
    const res = await fetch(API + '/transactions/withdraw', { method:'POST', headers: authHeaders(), body: JSON.stringify({amount}) });
    const {ok, body} = await parseResponse(res);
    if (ok){ await loadProfile(); await loadHistory(); showMessage('Withdrawal successful'); } else showMessage(body?.error || 'Withdrawal failed', 'error');
  });

  document.getElementById('transferBtn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('amount').value);
    const toUserIdRaw = document.getElementById('toUserId').value;
    const toUserId = parseInt(toUserIdRaw, 10);
    if (!amount || amount <= 0) return showMessage('Enter amount > 0', 'error');
    if (!Number.isInteger(toUserId) || toUserId <= 0) return showMessage('Enter a valid recipient user id (positive integer)', 'error');
    const res = await fetch(API + '/transactions/transfer', { method:'POST', headers: authHeaders(), body: JSON.stringify({ amount, toUserId }) });
    const {ok, body} = await parseResponse(res);
    if (ok){ await loadProfile(); await loadHistory(); showMessage('Transfer successful'); } else showMessage(body?.error || 'Transfer failed', 'error');
  });

  document.getElementById('logout').addEventListener('click', () => { localStorage.removeItem('mini_bank_token'); window.location.href = '/'; });

  loadProfile();
  loadHistory();
}
