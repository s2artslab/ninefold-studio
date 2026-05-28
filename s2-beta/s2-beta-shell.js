/**
 * S² beta disclaimer bar + feedback form (GitHub via s2-beta-feedback-proxy).
 * Include with data-s2-beta-app-id and optional data-s2-beta-app-name on the script tag.
 */
(function () {
  const script = document.currentScript;
  const appId = script?.getAttribute('data-s2-beta-app-id') || 's2-app';
  const appName = script?.getAttribute('data-s2-beta-app-name') || appId;
  const relayUrl =
    script?.getAttribute('data-s2-beta-relay-url') ||
    'https://s2-beta-feedback-proxy.s2artslab.workers.dev/feedback';

  const DISCLAIMER =
    'Beta preview — features may change or break without notice. Not for production, legal, medical, or financial decisions.';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  const root = el('div');
  root.id = 's2-beta-shell-root';

  const bar = el('div', 's2-beta-bar');
  const text = el('div', 's2-beta-bar__text');
  text.innerHTML =
    '<strong>Beta</strong> · ' +
    DISCLAIMER +
    ' <span style="opacity:0.85">(' +
    appName +
    ')</span>';

  const actions = el('div', 's2-beta-bar__actions');
  const feedbackBtn = el('button', null, 'Send beta feedback');
  const dismissBtn = el('button', 's2-beta-bar__ghost', 'Hide');
  actions.append(feedbackBtn, dismissBtn);
  bar.append(text, actions);

  const dialog = el('div', 's2-beta-dialog');
  dialog.hidden = true;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 's2-beta-dialog-title');

  const panel = el('div', 's2-beta-dialog__panel');
  const title = el('h2');
  title.id = 's2-beta-dialog-title';
  title.textContent = 'Beta feedback — ' + appName;
  const lead = el('p');
  lead.textContent =
    'Bugs, confusing flows, and ideas welcome. Reports go to the S² beta relay (GitHub + team alerts).';
  lead.style.margin = '0';
  lead.style.fontSize = '0.85rem';
  lead.style.color = '#94a3b8';

  const typeLabel = el('label', null, 'Type');
  const typeSelect = document.createElement('select');
  typeSelect.id = 's2-beta-type';
  [
    ['bug', 'Bug'],
    ['ui_issue', 'UI / UX'],
    ['feature_request', 'Feature idea'],
    ['general', 'General'],
  ].forEach(function (pair) {
    const opt = document.createElement('option');
    opt.value = pair[0];
    opt.textContent = pair[1];
    typeSelect.appendChild(opt);
  });

  const descLabel = el('label', null, 'What should we know?');
  const desc = document.createElement('textarea');
  desc.id = 's2-beta-desc';
  desc.placeholder = 'Steps to reproduce, what you expected, screenshots if any…';

  const emailLabel = el('label', null, 'Email (optional)');
  const email = document.createElement('input');
  email.type = 'email';
  email.id = 's2-beta-email';
  email.placeholder = 'you@example.com';
  email.style.width = '100%';
  email.style.padding = '0.45rem 0.55rem';
  email.style.borderRadius = '8px';
  email.style.border = '1px solid #475569';
  email.style.background = '#1e293b';
  email.style.color = '#f8fafc';

  const status = el('p', 's2-beta-status');
  status.setAttribute('role', 'status');

  const foot = el('div', 's2-beta-dialog__foot');
  const cancelBtn = el('button', 's2-beta-bar__ghost', 'Cancel');
  const sendBtn = el('button', null, 'Send');
  foot.append(cancelBtn, sendBtn);

  panel.append(title, lead, typeLabel, typeSelect, descLabel, desc, emailLabel, email, status, foot);
  dialog.append(panel);
  root.append(bar, dialog);

  function openDialog() {
    dialog.hidden = false;
    desc.focus();
  }

  function closeDialog() {
    dialog.hidden = true;
    status.textContent = '';
    status.className = 's2-beta-status';
  }

  feedbackBtn.addEventListener('click', openDialog);
  dismissBtn.addEventListener('click', function () {
    root.style.display = 'none';
    try {
      sessionStorage.setItem('s2-beta-bar-dismissed-' + appId, '1');
    } catch (_) {}
  });
  cancelBtn.addEventListener('click', closeDialog);
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) closeDialog();
  });

  sendBtn.addEventListener('click', async function () {
    const description = (desc.value || '').trim();
    if (!description) {
      status.textContent = 'Please describe the issue or idea.';
      status.className = 's2-beta-status s2-beta-status--err';
      return;
    }
    sendBtn.disabled = true;
    status.textContent = 'Sending…';
    status.className = 's2-beta-status';

    const payload = {
      id: String(Date.now()),
      appId: appId,
      feedbackType: typeSelect.value,
      description: description,
      severity: 'medium',
      timestamp: new Date().toISOString(),
      userEmail: (email.value || '').trim() || undefined,
      route: typeof location !== 'undefined' ? location.pathname + location.hash : undefined,
    };

    try {
      const res = await fetch(relayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        status.textContent = 'Thank you — feedback received.';
        status.className = 's2-beta-status s2-beta-status--ok';
        desc.value = '';
        setTimeout(closeDialog, 1400);
      } else {
        status.textContent = 'Could not send (HTTP ' + res.status + '). Try again later.';
        status.className = 's2-beta-status s2-beta-status--err';
      }
    } catch (err) {
      status.textContent = 'Offline or blocked — try again when connected.';
      status.className = 's2-beta-status s2-beta-status--err';
    } finally {
      sendBtn.disabled = false;
    }
  });

  try {
    if (sessionStorage.getItem('s2-beta-bar-dismissed-' + appId) === '1') {
      root.style.display = 'none';
    }
  } catch (_) {}

  if (document.body) {
    document.body.appendChild(root);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(root);
    });
  }
})();
