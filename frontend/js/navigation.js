document.addEventListener('DOMContentLoaded', async () => {
  const authedEls = document.querySelectorAll('[data-auth="authenticated"]');
  const anonEls = document.querySelectorAll('[data-auth="anonymous"]');
  const adminEls = document.querySelectorAll('[data-auth="admin"]');
  const logoutEls = document.querySelectorAll('[data-action="logout"]');

  const session = await window.CineNoteAuth.getSession();
  const isAdmin = session ? window.CineNoteAuth.isAdmin(session) : false;

  authedEls.forEach((el) => el.classList.toggle('hidden', !session));
  anonEls.forEach((el) => el.classList.toggle('hidden', !!session));
  adminEls.forEach((el) => el.classList.toggle('hidden', !isAdmin));

  logoutEls.forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      window.CineNoteAuth.logout();
      window.location.href = '/index.html';
    });
  });
});

