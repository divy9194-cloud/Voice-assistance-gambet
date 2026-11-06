const $ = s => document.querySelector(s);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

const APPS = {
  youtube:['com.google.android.youtube','https://youtube.com'],
  whatsapp:['com.whatsapp','https://web.whatsapp.com'],
  facebook:['com.facebook.katana','https://facebook.com'],
  instagram:['com.instagram.android','https://instagram.com'],
  telegram:['org.telegram.messenger','https://web.telegram.org'],
  spotify:['com.spotify.music','https://open.spotify.com'],
  gmail:['com.google.android.gm','https://mail.google.com'],
  maps:['com.google.android.apps.maps','https://maps.google.com'],
  twitter:['com.twitter.android','https://x.com'],
  snapchat:['com.snapchat.android','https://snapchat.com'],
  chrome:['com.android.chrome','https://google.com'],
  camera:['com.android.camera','https://google.com']
};

let rec, hands = false, state = 'ok', signup = false;

const sha = async t => [...new Uint8Array(
  await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
)].map(b => b.toString(16).padStart(2, '0')).join('');

/* ---------- LOGIN (demo: stored on this device only) ---------- */
function loginUI() {
  const s = localStorage.session;
  if (s) {
    $('#fields').hidden = true; $('#toggle').hidden = true;
    $('#ltitle').textContent = 'Welcome back';
    $('#go').textContent = 'Continue as ' + s;
  }
}
loginUI();

$('#toggle').onclick = () => {
  signup = !signup;
  $('#ltitle').textContent = signup ? 'Create account' : 'Sign in';
  $('#go').textContent = signup ? 'Sign up' : 'Sign in';
  $('#toggle').textContent = signup ? 'Have an account? Sign in' : 'New here? Create account';
  $('#err').textContent = '';
};

$('#go').onclick = async () => {
  if (localStorage.session && $('#fields').hidden) return start();
  const e = $('#email').value.trim().toLowerCase(), p = $('#pass').value;
  if (!e || p.length < 6) return $('#err').textContent = 'Enter email and a 6+ character password';
  const users = JSON.parse(localStorage.users || '{}'), h = await sha(p);
  if (signup) {
    if (users[e]) return $('#err').textContent = 'Account already exists';
    users[e] = h; localStorage.users = JSON.stringify(users);
  } else if (users[e] !== h) return $('#err').textContent = 'Wrong email or password';
  localStorage.session = e;
  start();
};

$('#out').onclick = () => {
  localStorage.removeItem('session');
  speechSynthesis.cancel(); try { rec && rec.abort(); } catch (e) {}
  location.reload();
};

function start() {
  $('#login').hidden = true; $('#app').hidden = false;
  state = localStorage.vl ? 'locked' : 'ok';
  hands = true; $('#hf').classList.add('on');   // always listening for the name "Gambet"
  say(state === 'locked' ? 'Gambet is locked. Say your voice phrase.' : 'I am Gambet. Would you like any help, sir?', true);
}

/* ---------- UI + SPEECH ---------- */
function add(t, cls, link) {
  const d = document.createElement('div');
  d.className = 'm ' + cls; d.textContent = t;
  if (link) { const a = document.createElement('a'); a.href = link; a.textContent = 'Tap to open'; d.append(a); }
  $('#chat').append(d); $('#chat').scrollTop = 1e9;
}

function say(t, thenListen) {
  add(t, 'bot');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.onend = () => { if (thenListen || hands) listen(); };
  speechSynthesis.speak(u);
}

function listen() {
  if (!SR) return add('Speech recognition is not supported. Please use Chrome.', 'bot');
  try { rec && rec.abort(); } catch (e) {}
  rec = new SR(); rec.lang = 'en-IN'; rec.interimResults = false;
  rec.onstart = () => $('#mic').classList.add('on');
  rec.onend = () => {
    $('#mic').classList.remove('on');
    if (hands && !speechSynthesis.speaking) setTimeout(listen, 400);
  };
  rec.onresult = e => handle(e.results[0][0].transcript);
  rec.start();
}

$('#mic').onclick = listen;
$('#hf').onclick = () => {
  hands = !hands; $('#hf').classList.toggle('on', hands);
  if (hands) say('Hands-free on. Say Gambet, then your command.');
  else { try { rec && rec.abort(); } catch (e) {} add('Hands-free off', 'bot'); }
};

/* ---------- COMMANDS ---------- */
async function handle(raw) {
  let t = raw.toLowerCase().trim();

  const WAKE = /\b((hey|hi|ok|okay)\s+)?(gambet|gambit|gambat|gambett|gumbet|gembet|gambhet)\b,?/;
  if (state === 'ok') {
    const woke = WAKE.test(t);
    if (hands && !woke) return;            // hands-free: only react when "Gambet" is said
    t = t.replace(WAKE, '').trim();
    if (!t) return say('Yes sir?', true);
  }
  add(raw, 'me');

  if (state === 'setlock') {
    localStorage.vl = await sha(t); state = 'ok';
    return say('Voice lock set. I will ask for it next time.');
  }
  if (state === 'locked') {
    if (await sha(t) === localStorage.vl) { state = 'ok'; return say('Unlocked. How can I help, sir?', true); }
    return say('Wrong phrase. Try again.', true);
  }

  if (/set (a )?voice lock/.test(t)) { state = 'setlock'; return say('Say your secret phrase now.', true); }
  if (/(remove|disable) voice lock/.test(t)) { localStorage.removeItem('vl'); return say('Voice lock removed.'); }
  if (/^lock/.test(t)) {
    if (!localStorage.vl) return say('Set a voice lock first. Say: set voice lock.');
    state = 'locked'; return say('Locked.');
  }

  if (/who (made|created|built|developed) you|your (developer|creator)/.test(t))
    return say('I was developed by Divyanshu Kumar.');

  if (/your name|who are you/.test(t)) return say('My name is Gambet, your voice assistant.');

  let m = t.match(/^(open|launch|start) (.+)/);
  if (m) return openApp(m[2].replace(/ app$/, ''));

  m = t.match(/^(play|search youtube for) (.+)/);
  if (m) return go('https://www.youtube.com/results?search_query=' + encodeURIComponent(m[2]), 'Searching YouTube');

  if (/\btime\b/.test(t) && !/who|what is/.test(t))
    return say(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  if (/\b(date|today)\b/.test(t) && !/who|what is/.test(t))
    return say(new Date().toDateString());

  return answer(t);
}

function go(url, msg) { say(msg); setTimeout(() => location.href = url, 1200); }

function openApp(name) {
  const key = Object.keys(APPS).find(k => name.includes(k));
  if (!key) return go('https://www.google.com/search?q=' + encodeURIComponent(name), 'I do not know that app, searching Google');
  const [pkg, fb] = APPS[key];
  const url = 'intent://#Intent;package=' + pkg + ';S.browser_fallback_url=' + encodeURIComponent(fb) + ';end';
  add('Opening ' + key, 'bot', url);
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance('Opening ' + key));
  setTimeout(() => location.href = url, 900);
}

async function answer(q) {
  const s = q.replace(/^(what is|what's|what are|who is|who was|tell me about|explain|define)\s+/, '').replace(/\?$/, '');
  try {
    const r = await fetch('https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch='
      + encodeURIComponent(s) + '&gsrlimit=1&prop=extracts&exintro&explaintext&exsentences=2&format=json&origin=*');
    const j = await r.json();
    const p = j.query && Object.values(j.query.pages)[0];
    say(p && p.extract ? p.extract : 'Sorry sir, I could not find that.');
  } catch (e) { say('I could not reach the internet. Please try again.'); }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
