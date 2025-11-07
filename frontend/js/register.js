document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#register-form');
  const alertEl = document.querySelector('#register-alert');

  const showAlert = (text, variant = 'error') => {
    alertEl.textContent = text;
    alertEl.className = `alert ${variant}`;
    alertEl.classList.remove('hidden');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alertEl.classList.add('hidden');

    const formData = new FormData(form);
    const username = formData.get('username');
    const email = formData.get('email');
    const password = formData.get('password');
    const confirm = formData.get('confirm');

    const usernamePattern = /^[A-Za-z0-9_.-]{3,32}$/;
    if (!usernamePattern.test(username)) {
      showAlert('Username must be 3-32 characters of letters, numbers, dot, dash, or underscore.');
      return;
    }

    if (password !== confirm) {
      showAlert('Passwords do not match');
      return;
    }

    try {
      await window.CineNoteAuth.registerUser({ username, email, password });
      showAlert('Account created. Check your email for confirmation.', 'success');
      form.reset();
    } catch (err) {
      console.error(err);
      showAlert(err.message || 'Registration failed');
    }
  });
});

