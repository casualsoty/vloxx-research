/* Feedback / Report a bug buttons (top bar). Contact name + page version come from window.FEEDBACK (set by build_docs.js). */
(function () {
  'use strict';
  const CFG = window.FEEDBACK || { name: 'soty', built: '' };
  const NAME = CFG.name, BUILT = CFG.built;
  function copy(text, okEl) {
    const done = () => { okEl.textContent = 'Copied ✓'; setTimeout(() => { okEl.textContent = ''; }, 1800); };
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { } ta.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  function where() {
    if (document.body.classList.contains('planner')) { const st = document.querySelector('.pl-stepname'); return 'Raid planner' + (st ? ' — ' + st.textContent : ''); }
    const on = document.querySelector('nav a.on'); const label = on ? [...on.childNodes].filter(n => !(n.classList && n.classList.contains('ic'))).map(n => n.textContent).join('').trim() : ''; return 'Knowledge base' + (label ? ' — ' + label : '');
  }
  function template(bug) {
    const ua = navigator.userAgent.replace(/^Mozilla\/5\.0 /, '');
    return bug
      ? ['[Vloxx docs — bug report]', 'Where: ' + where(), 'What happened:', 'What I expected:', 'Steps to reproduce:', 'Page version: ' + BUILT + ' · ' + ua].join('\n')
      : ['[Vloxx docs — feedback]', 'About: ' + where(), 'Feedback:', '(page version ' + BUILT + ')'].join('\n');
  }
  function open(kind) {
    const bug = kind === 'bug';
    const m = document.createElement('div'); m.className = 'fb-modal';
    m.innerHTML = '<div class="fb-box" role="dialog" aria-modal="true"><h4></h4>' +
      '<p>Message <b class="fb-n"></b> on Discord: corrections, new findings, bugs and logs worth looking at are all welcome.</p>' +
      '<div class="fb-name">Discord: <code class="fb-n"></code><button type="button" data-c="name">Copy name</button><span class="fb-ok" data-ok="name"></span></div>' +
      '<p class="fb-hint"></p><textarea spellcheck="false"></textarea>' +
      '<div class="fb-row"><span class="fb-ok" data-ok="msg"></span><button type="button" data-c="msg">Copy message</button><button type="button" data-c="close">Close</button></div></div>';
    m.querySelector('h4').textContent = bug ? 'Report a bug' : 'Send feedback';
    m.querySelectorAll('.fb-n').forEach(n => { n.textContent = NAME; });
    m.querySelector('.fb-hint').textContent = bug ? 'Copy this template, fill it in and paste it in your message (a screenshot helps a lot):' : 'Optional template to paste in your message:';
    m.querySelector('textarea').value = template(bug);
    document.body.appendChild(m);
    const esc = e => { if (e.key === 'Escape') close(); };
    function close() { m.remove(); document.removeEventListener('keydown', esc); }
    document.addEventListener('keydown', esc);
    m.addEventListener('click', e => {
      if (e.target === m) { close(); return; }
      const b = e.target.closest('[data-c]'); if (!b) return;
      if (b.dataset.c === 'close') close();
      else if (b.dataset.c === 'name') copy(NAME, m.querySelector('[data-ok=name]'));
      else copy(m.querySelector('textarea').value, m.querySelector('[data-ok=msg]'));
    });
    m.querySelector('[data-c=name]').focus();
  }
  document.querySelectorAll('[data-fb]').forEach(b => b.addEventListener('click', () => open(b.dataset.fb)));
  // keep planner keyboard shortcuts from firing while the dialog is open
  document.addEventListener('keydown', e => { if (document.querySelector('.fb-modal')) e.stopPropagation(); }, true);
})();
