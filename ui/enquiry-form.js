// Both forms keep their native action and use the same retry-safe intake.
document.addEventListener('submit', async ev => {
  const form = ev.target;
  if (!form.matches('#advisory-form, [data-firm-enquiry]')) return;
  ev.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  const status = form.querySelector('[role="status"]');
  status.textContent = 'Sending…';
  if (!form.elements.request_id.value && globalThis.crypto?.randomUUID) form.elements.request_id.value = crypto.randomUUID();
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new URLSearchParams(new FormData(form))
    });
    const receipt = await response.json();
    if (response.ok && receipt.ok === true) {
      const heading = document.createElement('h3');
      heading.textContent = 'Enquiry received';
      const note = document.createElement('p');
      note.textContent = 'Your message is in the RASBASH advisory inbox.';
      form.replaceChildren(heading, note);
      heading.tabIndex = -1;
      heading.focus();
    } else {
      status.textContent = receipt.error || 'Your enquiry could not be saved. Please try again.';
    }
  } catch {
    status.textContent = 'Delivery could not be confirmed. Your text is here so you can try again.';
  } finally {
    button.disabled = false;
  }
});
