const getQueryParam = (key) => new URLSearchParams(window.location.search).get(key);

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#verify-form');
  const alertEl = document.querySelector('#verify-alert');
  const resendBtn = document.querySelector('#resend-code');
  const usernameInput = document.querySelector('#verify-username');

  const showAlert = (text, variant = 'error') => {
    alertEl.textContent = text;
    alertEl.className = `alert ${variant}`;
    alertEl.classList.remove('hidden');
  };

  const hideAlert = () => {
    alertEl.classList.add('hidden');
  };

  const presetUsername = getQueryParam('username');
  if (presetUsername) {
    usernameInput.value = presetUsername;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert();
    const formData = new FormData(form);
    const username = formData.get('username');
    const code = formData.get('code');
    try {
      await window.CineNoteAuth.confirmRegistration({ username, code });
      showAlert('Account confirmed! You can now log in.', 'success');
      form.reset();
    } catch (err) {
      console.error(err);
      showAlert(err.message || 'Failed to confirm account');
    }
  });

  resendBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    hideAlert();
    const username = document.querySelector('#verify-username').value;
    if (!username) {
      showAlert('Enter your username first to resend the code.');
      return;
    }
    try {
      await window.CineNoteAuth.resendConfirmationCode({ username });
      showAlert('Verification code resent. Check your email.', 'success');
    } catch (err) {
      console.error(err);
      showAlert(err.message || 'Could not resend code');
    }
  });
});

