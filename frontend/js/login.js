document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#login-form');
  const alertEl = document.querySelector('#login-alert');

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
    const password = formData.get('password');

    try {
      await window.CineNoteAuth.login({ username, password });
      showAlert('Login successful. Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 1000);
    } catch (err) {
      console.error(err);
      showAlert(err.message || 'Login failed');
    }
  });
});

