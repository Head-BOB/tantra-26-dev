/**
 * slop-guard.js — AI Slop Detection & Guard for Tantra 26.
 * Detects em dashes (—) and flags AI copy-pasting across admin and organiser forms.
 */

export const SlopGuard = (function () {
  const PATTERNS = [{ re: /\u2014/g, name: 'em dash' }];
  let ov = null;

  function initOverlay() {
    if (ov) return;
    ov = document.createElement('div');
    ov.className = 'sg-ov';
    ov.innerHTML = `
      <div class="sg-box" role="alertdialog" aria-modal="true" aria-labelledby="sg-t">
        <div class="sg-h">
          <span class="sg-ic">!</span>
          <h3 id="sg-t">Hold on</h3>
        </div>
        <p class="sg-p" id="sg-p"></p>
        <ul class="sg-l" id="sg-l"></ul>
        <button type="button" class="sg-b" id="sg-x">Okay, I will rewrite it</button>
      </div>`;
    document.body.appendChild(ov);

    const closeBtn = ov.querySelector('#sg-x');
    if (closeBtn) closeBtn.onclick = close;
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
    });
  }

  const esc = t =>
    String(t).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));

  function all(root) {
    return [].slice.call((root || document).querySelectorAll('[data-slop]'));
  }

  function find(v) {
    const out = [];
    PATTERNS.forEach(p => {
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(v))) out.push(m.index);
    });
    return out.sort((a, b) => a - b);
  }

  function scan(root) {
    const hits = [];
    all(root).forEach(el => {
      const v = el.value || '';
      const ix = find(v);
      if (ix.length) hits.push({ el, label: el.getAttribute('data-slop') || 'Field', ix, v });
    });
    return hits;
  }

  function snip(h) {
    const i = h.ix[0];
    const a = Math.max(0, i - 30);
    const b = Math.min(h.v.length, i + 31);
    return (
      (a ? '…' : '') +
      esc(h.v.slice(a, i)) +
      '<mark>' +
      esc(h.v.charAt(i)) +
      '</mark>' +
      esc(h.v.slice(i + 1, b)) +
      (b < h.v.length ? '…' : '')
    );
  }

  function show(hits) {
    initOverlay();
    const n = hits.reduce((s, h) => s + h.ix.length, 0);
    const msgEl = document.getElementById('sg-p');
    if (msgEl) {
      msgEl.textContent =
        n +
        (n > 1 ? ' em dashes (—) were' : ' em dash (—) was') +
        ' found. We do not allow em dashes, please remove them and write this in your own words.';
    }
    const ul = document.getElementById('sg-l');
    if (ul) {
      ul.innerHTML = '';
      hits.forEach(h => {
        const li = document.createElement('li');
        li.innerHTML =
          '<b>' +
          esc(h.label) +
          ' (' +
          h.ix.length +
          ')</b><q>' +
          snip(h) +
          '</q><button type="button" class="sg-go">Take me there</button>';
        const btn = li.querySelector('button');
        if (btn) {
          btn.onclick = () => {
            close();
            h.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            setTimeout(() => {
              h.el.focus();
              try {
                h.el.setSelectionRange(h.ix[0], h.ix[0] + 1);
              } catch (e) {}
            }, 350);
          };
        }
        ul.appendChild(li);
      });
    }
    ov.classList.add('open');
    const sgX = document.getElementById('sg-x');
    if (sgX) sgX.focus();
  }

  function close() {
    if (ov) ov.classList.remove('open');
  }

  function flag(el) {
    const has = find(el.value || '').length > 0;
    el.classList.toggle('sg-flag', has);
    if (!el._sgn) {
      if (!has) return;
      const n = document.createElement('p');
      n.className = 'sg-note';
      el.insertAdjacentElement('afterend', n);
      el._sgn = n;
    }
    el._sgn.hidden = !has;
    el._sgn.textContent = has ? 'Em dash found (—). We do not allow em dashes, please remove it.' : '';
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('input', e => {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-slop')) {
        flag(e.target);
      }
    });
  }

  return {
    check: function (root) {
      const h = scan(root);
      if (!h.length) return true;
      show(h);
      return false;
    },
    flag,
    flagAll: function (root) {
      all(root).forEach(flag);
    },
  };
})();
