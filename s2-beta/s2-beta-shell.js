/**
 * S² beta disclaimer bar + Ake feedback chat (Forge beta chat API).
 * Include with data-s2-beta-app-id and optional data-s2-beta-app-name on the script tag.
 *
 * data-s2-beta-mode="chat" (default) | "relay" (legacy one-shot GitHub relay)
 * data-s2-beta-chat-url — override chat endpoint
 * Web overlay hides only when the host app signals a native beta bar
 *   (CustomEvent "s2-beta-native-bar" or window.S2_BETA_NATIVE_BAR === true).
 *   Flutter apps using S2BetaDisclaimerBar / S2BetaShell dispatch this automatically.
 * Optional BYOK Groq: saved in localStorage as s2-groq-key (via s2-auth bar) → X-Groq-Api-Key header
 * data-s2-beta-rag-namespaces — optional comma-separated RAG namespaces (default: product pack from appId)
 */
(function () {
  const script = document.currentScript;
  const appId = script?.getAttribute('data-s2-beta-app-id') || 's2-app';
  const appName = script?.getAttribute('data-s2-beta-app-name') || appId;
  const ragNamespacesAttr = script?.getAttribute('data-s2-beta-rag-namespaces') || '';
  const mode = (script?.getAttribute('data-s2-beta-mode') || 'chat').toLowerCase();
  const relayUrl =
    script?.getAttribute('data-s2-beta-relay-url') ||
    'https://s2-beta-feedback-proxy.s2artslab.workers.dev/feedback';
  const feedbackSecret = script?.getAttribute('data-s2-beta-feedback-secret') || '';
  const BETA_CHAT_PROXY =
    'https://s2-beta-feedback-proxy.s2artslab.workers.dev/beta-chat';
  const BETA_CAPABILITY_PROXY =
    script?.getAttribute('data-s2-beta-capability-url') ||
    'https://s2-beta-feedback-proxy.s2artslab.workers.dev/beta-capability';
  const BETA_ATTACH_PROXY =
    script?.getAttribute('data-s2-beta-attach-url') ||
    'https://s2-beta-feedback-proxy.s2artslab.workers.dev/beta-attachments';
  const BETA_ATTACH_MAX = 4;
  const BETA_ATTACH_MAX_BYTES = 4 * 1024 * 1024;
  const BETA_ATTACH_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,application/pdf';

  function defaultChatUrl() {
    const override = script?.getAttribute('data-s2-beta-chat-url');
    if (override) return override;
    return BETA_CHAT_PROXY;
  }

  function loadGroqKey() {
    try {
      const key = (localStorage.getItem('s2-groq-key') || '').trim();
      return key.startsWith('gsk_') ? key : '';
    } catch (_) {
      return '';
    }
  }

  function saveGroqKey(key) {
    const trimmed = String(key || '').trim();
    if (!trimmed) {
      try {
        localStorage.removeItem('s2-groq-key');
      } catch (_) {}
      return { ok: true, cleared: true };
    }
    if (!trimmed.startsWith('gsk_')) {
      return { ok: false, error: 'Groq keys start with gsk_' };
    }
    try {
      localStorage.setItem('s2-groq-key', trimmed);
      return { ok: true };
    } catch (_) {
      return { ok: false, error: 'Could not save key in this browser' };
    }
  }

  function defaultRagNamespaces() {
    if (ragNamespacesAttr.trim()) {
      return ragNamespacesAttr
        .split(/[,;\s]+/)
        .map(function (n) {
          return n.trim();
        })
        .filter(Boolean);
    }
    return ['s2-canon', 'community', 'product:' + appId];
  }

  function chatHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    headers['X-S2-Product-Id'] = appId;
    headers['X-S2-Inference'] = 'community-hosted';
    headers['X-S2-Community-Inference'] = 'beta-feedback';
    return headers;
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    const ms = timeoutMs || 35000;
    const controller = new AbortController();
    const timer = setTimeout(function () {
      controller.abort();
    }, ms);
    const opts = Object.assign({}, options || {}, { signal: controller.signal });
    return fetch(url, opts).finally(function () {
      clearTimeout(timer);
    });
  }

  function maskGroqKey(key) {
    if (!key || key.length < 12) return '';
    return key.slice(0, 8) + '…' + key.slice(-4);
  }

  const chatUrl = defaultChatUrl();
  const storageMessages = 's2-beta-chat.v1.' + appId;
  const storageIssue = 's2-beta-issue.v1.' + appId;

  const DISCLAIMER =
    'Preview — features may change without notice. Not for production, legal, medical, or financial use.';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function loadMessages() {
    try {
      const raw = sessionStorage.getItem(storageMessages);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveMessages(messages) {
    try {
      sessionStorage.setItem(storageMessages, JSON.stringify(messages.slice(-40)));
    } catch (_) {}
  }

  function loadIssue() {
    try {
      const raw = sessionStorage.getItem(storageIssue);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.issueNumber && parsed.issueUrl) return parsed;
    } catch (_) {}
    return null;
  }

  function saveIssue(issue) {
    try {
      if (issue) sessionStorage.setItem(storageIssue, JSON.stringify(issue));
      else sessionStorage.removeItem(storageIssue);
    } catch (_) {}
  }

  function isFixEligible(type) {
    return ['bug', 'ui_issue', 'performance'].indexOf(type) >= 0;
  }

  function isProductType(type) {
    return ['feature_request', 'general'].indexOf(type) >= 0;
  }

  /** Opt-in identity from s2-auth session (browse stays open without sign-in). */
  function betaReporterEmail() {
    try {
      const session =
        window.S2Auth && typeof window.S2Auth.getSession === 'function'
          ? window.S2Auth.getSession()
          : null;
      const email =
        session && session.user && session.user.email
          ? String(session.user.email).trim()
          : '';
      return email || undefined;
    } catch (_) {
      return undefined;
    }
  }

  function inputPlaceholderForType(type) {
    if (isProductType(type)) {
      return 'What would make this better? Who would benefit?';
    }
    return 'What broke or felt confusing? Steps to reproduce help.';
  }

  const root = el('div');
  root.id = 's2-beta-shell-root';

  const bar = el('div', 's2-beta-bar');
  const text = el('div', 's2-beta-bar__text');
  text.innerHTML = '<strong>Beta</strong> ' + DISCLAIMER;

  const actions = el('div', 's2-beta-bar__actions');
  const feedbackBtn = el('button', null, mode === 'relay' ? 'Send beta feedback' : 'Feedback');
  const dismissBtn = el('button', 's2-beta-bar__ghost', 'Hide');
  feedbackBtn.type = 'button';
  dismissBtn.type = 'button';
  actions.append(feedbackBtn, dismissBtn);
  bar.append(text, actions);

  const floatingBtn = el('button', 's2-beta-floating', 'Feedback');
  floatingBtn.type = 'button';
  floatingBtn.hidden = true;
  floatingBtn.setAttribute('aria-label', 'Open beta feedback');

  const dialog = el('div', 's2-beta-dialog');
  dialog.hidden = true;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 's2-beta-dialog-title');

  const panel = el('div', 's2-beta-dialog__panel');
  const title = el('h2');
  title.id = 's2-beta-dialog-title';
  title.textContent = mode === 'relay' ? 'Beta feedback — ' + appName : 'Beta feedback — Ake';
  const lead = el('p');
  lead.textContent =
    mode === 'relay'
      ? 'Bugs, confusing flows, and ideas welcome. Reports go to the S² beta relay (GitHub + team alerts).'
      : 'Describe what felt broken or confusing. S² AI on our home servers is always included for beta feedback — no Groq key or subscription. Reports still log to GitHub during training.';
  lead.style.margin = '0';
  lead.style.fontSize = '0.85rem';
  lead.style.color = '#94a3b8';

  const maintenanceBanner = el('div', 's2-beta-maintenance');
  maintenanceBanner.hidden = true;
  maintenanceBanner.setAttribute('role', 'status');

  const guidance = el('div', 's2-beta-guidance');
  guidance.innerHTML =
    '<p><strong>Something broken?</strong> Choose <em>Bug</em> or <em>UI / UX</em> — you can ask Ake to open a fix PR for review.</p>' +
    '<p><strong>Idea or improvement?</strong> Choose <em>Feature idea</em> or <em>General</em> — logged for the roadmap; team gets Slack + email; no auto-fix.</p>';

  const groqNote = el('p', 's2-beta-groq-note');
  groqNote.style.fontSize = '0.72rem';
  groqNote.style.color = '#64748b';
  groqNote.style.margin = '0.35rem 0 0';

  const groqRow = el('div', 's2-beta-groq-row');
  const groqInput = document.createElement('input');
  groqInput.type = 'password';
  groqInput.className = 's2-beta-groq-input';
  groqInput.placeholder = 'gsk_… optional Groq key';
  groqInput.autocomplete = 'off';
  groqInput.setAttribute('aria-label', 'Optional Groq API key');
  const groqSaveBtn = el('button', 's2-beta-bar__ghost', 'Save key');
  groqSaveBtn.type = 'button';
  const groqClearBtn = el('button', 's2-beta-bar__ghost', 'Clear');
  groqClearBtn.type = 'button';
  groqRow.append(groqInput, groqSaveBtn, groqClearBtn);

  const issueLink = el('p', 's2-beta-issue-link');
  issueLink.style.fontSize = '0.75rem';
  issueLink.style.margin = '0.5rem 0 0';

  const messagesHost = el('div', 's2-beta-chat__messages');
  messagesHost.setAttribute('role', 'log');
  messagesHost.setAttribute('aria-live', 'polite');

  const typeLabel = el('label', null, 'Type');
  const typeSelect = document.createElement('select');
  typeSelect.id = 's2-beta-type';
  [
    ['ui_issue', 'UI / UX'],
    ['bug', 'Bug'],
    ['performance', 'Performance'],
    ['feature_request', 'Feature idea'],
    ['general', 'General'],
  ].forEach(function (pair) {
    const opt = document.createElement('option');
    opt.value = pair[0];
    opt.textContent = pair[1];
    typeSelect.appendChild(opt);
  });

  const attachRow = el('div', 's2-beta-attach-row');
  const attachBtn = el('button', 's2-beta-attach-btn', 'Attach');
  attachBtn.type = 'button';
  attachBtn.setAttribute('aria-label', 'Attach screenshot or PDF');
  const attachInput = document.createElement('input');
  attachInput.type = 'file';
  attachInput.accept = BETA_ATTACH_ACCEPT;
  attachInput.multiple = true;
  attachInput.hidden = true;
  attachInput.className = 's2-beta-attach-input';
  const attachPreview = el('div', 's2-beta-attach-preview');
  attachRow.append(attachBtn, attachPreview, attachInput);

  const inputRow = el('div', 's2-beta-chat__input-row');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 's2-beta-chat__input';
  input.placeholder = inputPlaceholderForType(typeSelect.value);
  input.setAttribute('aria-label', 'Beta feedback message');

  const sendBtn = el('button', null, 'Send');
  inputRow.append(input, sendBtn);

  const fixBtn = el('button', 's2-beta-fix-btn');
  fixBtn.type = 'button';
  fixBtn.textContent = 'Ask Ake to fix (opens PR for review)';
  fixBtn.hidden = true;

  const status = el('p', 's2-beta-status');
  status.setAttribute('role', 'status');

  const foot = el('div', 's2-beta-dialog__foot');
  const clearBtn = el('button', 's2-beta-bar__ghost', 'New chat');
  const cancelBtn = el('button', 's2-beta-bar__ghost', 'Close');
  foot.append(clearBtn, cancelBtn);

  let capabilityState = { hosted_available: true };

  panel.append(
    title,
    lead,
    maintenanceBanner,
    guidance,
    groqNote,
    groqRow,
    issueLink,
    messagesHost,
    typeLabel,
    typeSelect,
    attachRow,
    inputRow,
    fixBtn,
    status,
    foot,
  );
  dialog.append(panel);
  root.append(bar, floatingBtn, dialog);

  let messages = [];
  let issueRef = null;
  let sending = false;
  /** @type {{ id?: string, url?: string, name: string, mimeType: string, size: number, previewUrl?: string }[]} */
  let pendingAttachments = [];

  function readFileBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const result = String(reader.result || '');
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = function () {
        reject(reader.error || new Error('read failed'));
      };
      reader.readAsDataURL(file);
    });
  }

  function attachmentHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (feedbackSecret) headers['X-Beta-Feedback-Secret'] = feedbackSecret;
    const groqKey = loadGroqKey();
    if (groqKey) headers['X-Groq-Api-Key'] = groqKey;
    return headers;
  }

  async function uploadAttachment(file) {
    if (file.size > BETA_ATTACH_MAX_BYTES) {
      throw new Error(file.name + ' exceeds 4 MB');
    }
    const dataBase64 = await readFileBase64(file);
    const res = await fetch(BETA_ATTACH_PROXY, {
      method: 'POST',
      headers: attachmentHeaders(),
      body: JSON.stringify({
        appId: appId,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataBase64: dataBase64,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Upload failed (HTTP ' + res.status + ')');
    }
    return {
      id: data.id,
      url: data.url,
      name: data.name || file.name,
      mimeType: data.mimeType || file.type,
      size: data.size || file.size,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    };
  }

  function renderAttachmentPreview() {
    attachPreview.innerHTML = '';
    if (!pendingAttachments.length) return;
    pendingAttachments.forEach(function (att, idx) {
      const chip = el('div', 's2-beta-attach-chip');
      if (att.previewUrl) {
        const img = document.createElement('img');
        img.src = att.previewUrl;
        img.alt = att.name;
        img.className = 's2-beta-attach-thumb';
        chip.appendChild(img);
      } else {
        chip.appendChild(el('span', 's2-beta-attach-file', att.name));
      }
      const remove = el('button', 's2-beta-attach-remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove ' + att.name);
      remove.addEventListener('click', function () {
        if (att.previewUrl) {
          try {
            URL.revokeObjectURL(att.previewUrl);
          } catch (_) {}
        }
        pendingAttachments = pendingAttachments.filter(function (_, i) {
          return i !== idx;
        });
        renderAttachmentPreview();
      });
      chip.appendChild(remove);
      attachPreview.appendChild(chip);
    });
  }

  async function uploadPendingAttachments() {
    const uploaded = [];
    for (let i = 0; i < pendingAttachments.length; i++) {
      const att = pendingAttachments[i];
      if (att.url) {
        uploaded.push({
          id: att.id,
          url: att.url,
          name: att.name,
          mimeType: att.mimeType,
          size: att.size,
        });
        continue;
      }
      if (!att._file) continue;
      const stored = await uploadAttachment(att._file);
      uploaded.push({
        id: stored.id,
        url: stored.url,
        name: stored.name,
        mimeType: stored.mimeType,
        size: stored.size,
      });
    }
    return uploaded;
  }

  function clearPendingAttachments() {
    pendingAttachments.forEach(function (att) {
      if (att.previewUrl) {
        try {
          URL.revokeObjectURL(att.previewUrl);
        } catch (_) {}
      }
    });
    pendingAttachments = [];
    renderAttachmentPreview();
    attachInput.value = '';
  }

  function renderMessages() {
    messagesHost.innerHTML = '';
    if (!messages.length) {
      const empty = el('p', 's2-beta-chat__empty', 'What should we know about this beta build?');
      messagesHost.appendChild(empty);
      return;
    }
    messages.forEach(function (m) {
      const bubble = el('div', 's2-beta-chat__bubble s2-beta-chat__bubble--' + m.role);
      const who = el('span', 's2-beta-chat__who', m.role === 'user' ? 'You' : 'Ake');
      const body = el('div', null, m.content);
      bubble.append(who, body);
      if (m.attachments && m.attachments.length) {
        const attHost = el('div', 's2-beta-chat__attachments');
        m.attachments.forEach(function (att) {
          if (att.mimeType && att.mimeType.startsWith('image/') && att.url) {
            const img = document.createElement('img');
            img.src = att.url;
            img.alt = att.name || 'attachment';
            img.className = 's2-beta-chat__attachment-img';
            attHost.appendChild(img);
          } else if (att.url) {
            const a = document.createElement('a');
            a.href = att.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = att.name || 'attachment';
            attHost.appendChild(a);
          }
        });
        bubble.appendChild(attHost);
      }
      messagesHost.appendChild(bubble);
    });
    messagesHost.scrollTop = messagesHost.scrollHeight;
  }

  function renderIssueLink() {
    issueLink.innerHTML = '';
    if (issueRef && issueRef.issueUrl) {
      const a = document.createElement('a');
      a.href = issueRef.issueUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'GitHub issue #' + issueRef.issueNumber;
      a.style.color = '#38bdf8';
      issueLink.appendChild(a);
    }
    fixBtn.hidden = !(mode === 'chat' && issueRef && isFixEligible(typeSelect.value));
    typeSelect.disabled = Boolean(issueRef);
    input.placeholder = inputPlaceholderForType(typeSelect.value);
    if (mode === 'chat') {
      guidance.hidden = Boolean(issueRef);
    }
  }

  function renderMaintenanceBanner() {
    if (mode === 'relay') {
      maintenanceBanner.hidden = true;
      return;
    }
    const down = capabilityState.hosted_available === false;
    maintenanceBanner.hidden = !down;
    if (!down) return;
    const msg =
      capabilityState.hosted_maintenance_message ||
      'Hosted Ake (Qwen on r730) is offline for training or GPU work. Feedback still logs to GitHub.';
    const platform = capabilityState.platform_groq_fallback;
    maintenanceBanner.innerHTML =
      '<strong>Hosted Ake offline</strong> — ' +
      msg +
      (platform
        ? ' Platform fallback may answer when training finishes.'
        : ' Your feedback still logs to GitHub — try chat again shortly.');
  }

  function renderGroqNote() {
    if (mode === 'relay') {
      groqNote.textContent = '';
      groqRow.hidden = true;
      return;
    }
    groqRow.hidden = true;
    groqNote.textContent =
      'S² AI is included for beta chat — no key or subscription. Optional Groq keys are not used on this path.';
  }

  async function refreshCapability() {
    if (mode === 'relay') return;
    try {
      const res = await fetch(BETA_CAPABILITY_PROXY, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data === 'object') {
        capabilityState = data;
        renderMaintenanceBanner();
        renderGroqNote();
      }
    } catch (_) {}
  }

  function openDialog() {
    root.style.display = '';
    dialog.hidden = false;
    messages = loadMessages();
    issueRef = loadIssue();
    renderMessages();
    renderIssueLink();
    renderGroqNote();
    refreshCapability();
    input.focus();
  }

  function dismissBar() {
    bar.style.display = 'none';
    floatingBtn.hidden = false;
    try {
      sessionStorage.setItem('s2-beta-bar-dismissed-' + appId, '1');
    } catch (_) {}
  }

  function restoreBarIfNeeded() {
    try {
      if (sessionStorage.getItem('s2-beta-bar-dismissed-' + appId) === '1') {
        bar.style.display = 'none';
        floatingBtn.hidden = false;
      }
    } catch (_) {}
  }

  function closeDialog() {
    dialog.hidden = true;
    status.textContent = '';
    status.className = 's2-beta-status';
  }

  async function sendChat(text, requestFix) {
    const prompt = String(text || '').trim();
    if ((!prompt && !pendingAttachments.length) || sending) return;
    sending = true;
    sendBtn.disabled = true;
    fixBtn.disabled = true;
    attachBtn.disabled = true;
    status.textContent = pendingAttachments.length ? 'Uploading attachments…' : 'Ake is thinking…';
    status.className = 's2-beta-status';

    let attachments = [];
    try {
      attachments = await uploadPendingAttachments();
    } catch (err) {
      sending = false;
      sendBtn.disabled = false;
      fixBtn.disabled = false;
      attachBtn.disabled = false;
      status.textContent = err && err.message ? err.message : String(err);
      status.className = 's2-beta-status s2-beta-status--err';
      return;
    }

    const userContent = prompt || '(see attached files)';
    messages = messages.concat([{ role: 'user', content: userContent, attachments: attachments }]);
    saveMessages(messages);
    renderMessages();
    input.value = '';
    clearPendingAttachments();
    status.textContent = 'Ake is thinking…';

    try {
      const res = await fetchWithTimeout(chatUrl, {
        method: 'POST',
        headers: chatHeaders(),
        body: JSON.stringify({
          messages: messages.map(function (m) {
            return { role: m.role, content: m.content, attachments: m.attachments || [] };
          }),
          prompt: userContent,
          attachments: attachments,
          appId: appId,
          product_id: appId,
          rag_namespaces: defaultRagNamespaces(),
          context: 'beta-feedback',
          community_surface: 'beta-feedback',
          feedbackType: typeSelect.value,
          severity: 'medium',
          issueNumber: issueRef ? issueRef.issueNumber : undefined,
          requestFix: Boolean(requestFix),
          userEmail: betaReporterEmail(),
          route:
            typeof location !== 'undefined' ? location.pathname + location.hash : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.reply || 'HTTP ' + res.status);
      }
      const reply = String(data.reply || '').trim() || 'Thanks — logged.';
      messages = messages.concat([{ role: 'assistant', content: reply }]);
      saveMessages(messages);
      renderMessages();
      if (data.issueNumber && data.issueUrl) {
        issueRef = { issueNumber: data.issueNumber, issueUrl: data.issueUrl };
        saveIssue(issueRef);
        renderIssueLink();
      }
      if (data.hosted_down && data.feedback_logged) {
        status.textContent = data.issueUrl
          ? 'Hosted Ake offline — feedback logged on GitHub.'
          : 'Hosted Ake offline — message saved.';
        status.className = 's2-beta-status s2-beta-status--warn';
      } else if (data.autofix && data.autofix.pullRequestUrl) {
        status.textContent = 'Fix PR opened — review before merge.';
        status.className = 's2-beta-status s2-beta-status--ok';
      } else if (data.autofixOffered) {
        status.textContent = 'Say "fix it" or use Ask Ake to fix when ready.';
      } else if (isProductType(typeSelect.value)) {
        status.textContent = data.issueUrl
          ? 'Logged for the roadmap — team notified (Slack + email).'
          : 'Reply saved.';
        status.className = 's2-beta-status s2-beta-status--ok';
      } else {
        status.textContent = data.issueUrl ? 'Logged on GitHub.' : 'Reply saved.';
        status.className = 's2-beta-status s2-beta-status--ok';
      }
    } catch (err) {
      const msg =
        err && err.name === 'AbortError'
          ? 'Request timed out — feedback may still log when the server catches up.'
          : err && err.message
            ? err.message
            : String(err);
      const fallback =
        'Beta chat hit an error (' +
        msg +
        '). Your message is saved — try again when online.';
      messages = messages.concat([{ role: 'assistant', content: fallback }]);
      saveMessages(messages);
      renderMessages();
      status.textContent = msg;
      status.className = 's2-beta-status s2-beta-status--err';
    } finally {
      sending = false;
      sendBtn.disabled = false;
      fixBtn.disabled = false;
      attachBtn.disabled = false;
    }
  }

  async function sendRelay() {
    const descEl = document.getElementById('s2-beta-desc');
    const description = String((descEl && descEl.value) || input.value || '').trim();
    if (!description && !pendingAttachments.length) {
      status.textContent = 'Please describe the issue or idea.';
      status.className = 's2-beta-status s2-beta-status--err';
      return;
    }
    sendBtn.disabled = true;
    attachBtn.disabled = true;
    status.textContent = pendingAttachments.length ? 'Uploading attachments…' : 'Sending…';
    status.className = 's2-beta-status';

    let attachments = [];
    try {
      attachments = await uploadPendingAttachments();
    } catch (err) {
      sendBtn.disabled = false;
      attachBtn.disabled = false;
      status.textContent = err && err.message ? err.message : String(err);
      status.className = 's2-beta-status s2-beta-status--err';
      return;
    }
    status.textContent = 'Sending…';

    const payload = {
      id: String(Date.now()),
      appId: appId,
      feedbackType: typeSelect.value,
      description: description || '(see attached files)',
      severity: 'medium',
      timestamp: new Date().toISOString(),
      userEmail: betaReporterEmail(),
      route: typeof location !== 'undefined' ? location.pathname + location.hash : undefined,
      attachments: attachments,
    };

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (feedbackSecret) headers['X-Beta-Feedback-Secret'] = feedbackSecret;
      const res = await fetch(relayUrl, { method: 'POST', headers: headers, body: JSON.stringify(payload) });
      if (res.ok) {
        status.textContent = 'Thank you — feedback received.';
        status.className = 's2-beta-status s2-beta-status--ok';
        input.value = '';
        clearPendingAttachments();
        setTimeout(closeDialog, 1400);
      } else {
        status.textContent = 'Could not send (HTTP ' + res.status + '). Try again later.';
        status.className = 's2-beta-status s2-beta-status--err';
      }
    } catch (_) {
      status.textContent = 'Network error — check connection and try again.';
      status.className = 's2-beta-status s2-beta-status--err';
    } finally {
      sendBtn.disabled = false;
      attachBtn.disabled = false;
    }
  }

  attachBtn.addEventListener('click', function () {
    if (pendingAttachments.length >= BETA_ATTACH_MAX) {
      status.textContent = 'Maximum ' + BETA_ATTACH_MAX + ' attachments per message.';
      status.className = 's2-beta-status s2-beta-status--err';
      return;
    }
    attachInput.click();
  });

  attachInput.addEventListener('change', function () {
    const files = Array.from(attachInput.files || []);
    if (!files.length) return;
    const room = BETA_ATTACH_MAX - pendingAttachments.length;
    const slice = files.slice(0, room);
    slice.forEach(function (file) {
      pendingAttachments.push({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
        _file: file,
      });
    });
    renderAttachmentPreview();
    attachInput.value = '';
    if (files.length > room) {
      status.textContent = 'Only ' + BETA_ATTACH_MAX + ' attachments allowed per message.';
      status.className = 's2-beta-status s2-beta-status--err';
    }
  });

  feedbackBtn.addEventListener('click', openDialog);
  floatingBtn.addEventListener('click', openDialog);
  dismissBtn.addEventListener('click', dismissBar);
  cancelBtn.addEventListener('click', closeDialog);
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) closeDialog();
  });

  clearBtn.addEventListener('click', function () {
    messages = [];
    issueRef = null;
    saveMessages([]);
    saveIssue(null);
    renderMessages();
    renderIssueLink();
    status.textContent = '';
  });

  sendBtn.addEventListener('click', function () {
    if (mode === 'relay') void sendRelay();
    else void sendChat(input.value, false);
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (mode === 'relay') void sendRelay();
      else void sendChat(input.value, false);
    }
  });

  fixBtn.addEventListener('click', function () {
    void sendChat('Please fix this issue.', true);
  });

  groqSaveBtn.addEventListener('click', function () {
    const result = saveGroqKey(groqInput.value);
    if (!result.ok) {
      status.textContent = result.error || 'Could not save Groq key';
      status.className = 's2-beta-status s2-beta-status--err';
      return;
    }
    groqInput.value = '';
    renderGroqNote();
    status.textContent = result.cleared
      ? capabilityState.hosted_available === false
        ? 'Groq key cleared — hosted Qwen still offline; add a key for chat.'
        : 'Groq key cleared — using hosted Qwen.'
      : 'Groq key saved in this browser.';
    status.className = 's2-beta-status s2-beta-status--ok';
  });

  groqClearBtn.addEventListener('click', function () {
    saveGroqKey('');
    groqInput.value = '';
    renderGroqNote();
    status.textContent = 'Groq key cleared.';
    status.className = 's2-beta-status s2-beta-status--ok';
  });

  typeSelect.addEventListener('change', renderIssueLink);

  if (mode === 'relay') {
    messagesHost.hidden = true;
    fixBtn.hidden = true;
    clearBtn.hidden = true;
    issueLink.hidden = true;
    guidance.hidden = true;
    groqNote.hidden = true;
    groqRow.hidden = true;
    typeLabel.textContent = 'What should we know?';
    const desc = document.createElement('textarea');
    desc.id = 's2-beta-desc';
    desc.placeholder = 'Steps to reproduce, what you expected, or attach screenshots below…';
    desc.style.minHeight = '5rem';
    desc.style.width = '100%';
    desc.style.font = 'inherit';
    desc.style.borderRadius = '8px';
    desc.style.border = '1px solid #475569';
    desc.style.background = '#1e293b';
    desc.style.color = '#f8fafc';
    desc.style.padding = '0.45rem 0.55rem';
    panel.insertBefore(desc, typeLabel);
    inputRow.hidden = true;
    foot.insertBefore(sendBtn, clearBtn);
    sendBtn.textContent = 'Send';
  }

  restoreBarIfNeeded();

  function hideWebBetaBar() {
    bar.style.display = 'none';
    floatingBtn.hidden = true;
  }

  window.S2Beta = {
    openChat: openDialog,
    openFeedback: openDialog,
    showBar: function () {
      bar.style.display = '';
      floatingBtn.hidden = true;
      try {
        sessionStorage.removeItem('s2-beta-bar-dismissed-' + appId);
      } catch (_) {}
    },
    appId: appId,
    hideWebBar: hideWebBetaBar,
    signalNativeBar: hideWebBetaBar,
  };

  /** Hide web overlay only when Flutter (or host app) mounts its own beta bar. */
  window.addEventListener('s2-beta-native-bar', hideWebBetaBar);
  try {
    if (window.S2_BETA_NATIVE_BAR === true) hideWebBetaBar();
  } catch (_) {}

  if (document.body) {
    document.body.appendChild(root);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(root);
    });
  }
})();
