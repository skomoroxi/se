// "Discuss your project" modal with reCAPTCHA v3. Sends to the Worker at /api/contact.
(() => {
  const lang = document.documentElement.lang === 'ru' ? 'ru' : 'en';
  const T = {
    en: {
      title: 'Discuss your project',
      intro: 'Tell us a little about your site and goals. We’ll reply by email.',
      name: 'Name', email: 'Email', message: 'Request description', optional: 'optional',
      messagePh: 'Your site, niche, markets and what you’d like to achieve',
      submit: 'Send request', sending: 'Sending…', close: 'Close',
      ok: 'Thank you! Your request has been sent. We’ll get back to you soon.',
      errCaptcha: 'The spam check didn’t pass. Please try again in a moment.',
      errValidation: 'Please check the highlighted fields.',
      errGeneric: 'Something went wrong. Please try again later.',
      legal: 'This site is protected by reCAPTCHA and the Google <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener">Terms of Service</a> apply.',
    },
    ru: {
      title: 'Обсудить проект',
      intro: 'Расскажите немного о сайте и задачах. Мы ответим по email.',
      name: 'Имя', email: 'Email', message: 'Описание запроса', optional: 'необязательно',
      messagePh: 'Ваш сайт, ниша, рынки и чего хотите достичь',
      submit: 'Отправить запрос', sending: 'Отправляем…', close: 'Закрыть',
      ok: 'Спасибо! Ваш запрос отправлен. Мы скоро свяжемся с вами.',
      errCaptcha: 'Проверка на спам не пройдена. Попробуйте ещё раз через минуту.',
      errValidation: 'Проверьте выделенные поля.',
      errGeneric: 'Что-то пошло не так. Попробуйте позже.',
      legal: 'Сайт защищён reCAPTCHA, действуют <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Политика конфиденциальности</a> и <a href="https://policies.google.com/terms" target="_blank" rel="noopener">Условия использования</a> Google.',
    },
  }[lang];

  let siteKey = null;
  let recaptchaLoading = null;

  function loadRecaptcha() {
    if (recaptchaLoading) return recaptchaLoading;
    recaptchaLoading = fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => {
        siteKey = cfg.siteKey || '';
        if (!siteKey) return;
        return new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(siteKey) + '&hl=' + lang;
          s.async = true;
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      })
      .catch(() => { recaptchaLoading = null; });
    return recaptchaLoading;
  }

  async function getToken() {
    await loadRecaptcha();
    if (!siteKey || !window.grecaptcha) return '';
    await new Promise((resolve) => window.grecaptcha.ready(resolve));
    return window.grecaptcha.execute(siteKey, { action: 'contact' });
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'cf-dialog';
  dialog.setAttribute('aria-labelledby', 'cf-title');
  dialog.innerHTML = `
    <form class="cf-form" novalidate>
      <div class="cf-head">
        <h2 id="cf-title">${T.title}</h2>
        <button type="button" class="cf-close" aria-label="${T.close}">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <p class="cf-intro">${T.intro}</p>
      <div class="cf-body">
        <label class="cf-field">
          <span>${T.name} <b aria-hidden="true">*</b></span>
          <input name="name" type="text" autocomplete="name" required maxlength="100">
        </label>
        <label class="cf-field">
          <span>${T.email} <b aria-hidden="true">*</b></span>
          <input name="email" type="email" autocomplete="email" required maxlength="254">
        </label>
        <label class="cf-field">
          <span>${T.message} <i>(${T.optional})</i></span>
          <textarea name="message" rows="5" maxlength="5000" placeholder="${T.messagePh}"></textarea>
        </label>
        <label class="cf-hp" aria-hidden="true">Website <input name="website" type="text" tabindex="-1" autocomplete="off"></label>
        <p class="cf-status" role="status" aria-live="polite"></p>
        <button type="submit" class="cf-submit">${T.submit}</button>
        <p class="cf-legal">${T.legal}</p>
      </div>
      <div class="cf-done" hidden>
        <p>${T.ok}</p>
        <button type="button" class="cf-submit cf-close-done">${T.close}</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);

  const form = dialog.querySelector('form');
  const status = dialog.querySelector('.cf-status');
  const submit = dialog.querySelector('.cf-submit');
  const body = dialog.querySelector('.cf-body');
  const done = dialog.querySelector('.cf-done');

  function open() {
    if (!dialog.open) dialog.showModal();
    loadRecaptcha();
    setTimeout(() => form.elements.name.focus(), 30);
  }
  function close() { dialog.close(); }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-contact-open]')) { e.preventDefault(); open(); }
  });
  dialog.querySelector('.cf-close').addEventListener('click', close);
  dialog.querySelector('.cf-close-done').addEventListener('click', close);
  // Close on backdrop click.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.addEventListener('close', () => {
    if (!done.hidden) { form.reset(); done.hidden = true; body.hidden = false; }
  });

  function setStatus(msg, isError) {
    status.textContent = msg;
    status.classList.toggle('cf-error', !!isError);
  }

  function markInvalid(fields) {
    for (const el of form.querySelectorAll('input, textarea')) el.removeAttribute('aria-invalid');
    for (const k of fields) form.elements[k] && form.elements[k].setAttribute('aria-invalid', 'true');
    if (fields.length) form.elements[fields[0]].focus();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = ['name', 'email'].filter((k) => !form.elements[k].checkValidity() || !form.elements[k].value.trim());
    markInvalid(bad);
    if (bad.length) { setStatus(T.errValidation, true); return; }

    submit.disabled = true;
    submit.textContent = T.sending;
    setStatus('', false);
    try {
      let token = '';
      try { token = await getToken(); } catch { token = ''; }
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.elements.name.value.trim(),
          email: form.elements.email.value.trim(),
          message: form.elements.message.value.trim(),
          website: form.elements.website.value,
          page: location.pathname,
          lang,
          token,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        body.hidden = true;
        done.hidden = false;
        done.querySelector('button').focus();
      } else if (data.error === 'validation') {
        markInvalid(Object.keys(data.fields || {}));
        setStatus(T.errValidation, true);
      } else if (data.error === 'captcha') {
        setStatus(T.errCaptcha, true);
      } else {
        setStatus(T.errGeneric, true);
      }
    } catch {
      setStatus(T.errGeneric, true);
    } finally {
      submit.disabled = false;
      submit.textContent = T.submit;
    }
  });
})();
