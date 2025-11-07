document.addEventListener('DOMContentLoaded', async () => {
  const listEl = document.querySelector('#movie-grid');
  const messageEl = document.querySelector('#movie-message');
  const landingHero = document.querySelector('#landing-hero');
  const moviesSection = document.querySelector('#movies-section');

  const showMessage = (text) => {
    messageEl.textContent = text;
    messageEl.classList.remove('hidden');
  };

  const session = await window.CineNoteAuth.getSession();
  if (!session) {
    landingHero.classList.remove('hidden');
    moviesSection.classList.add('hidden');
    return;
  }

  landingHero.classList.add('hidden');
  moviesSection.classList.remove('hidden');

  try {
    const movies = await CineNoteApi.listMovies();
    if (!movies || movies.length === 0) {
      showMessage('No movies yet. Check back soon.');
      return;
    }
    listEl.innerHTML = movies.map((movie) => `
      <article class="card">
        <img src="${movie.posterUrl}" alt="Poster for ${movie.title}" loading="lazy" />
        <div class="card-content">
          <h2>${movie.title}</h2>
          <p>${movie.year}</p>
          <span class="rating-badge">⭐ ${movie.averageRating ?? 'N/A'}</span>
          <p>${movie.description?.slice(0, 120) ?? ''}${movie.description && movie.description.length > 120 ? '…' : ''}</p>
          <a class="button secondary" href="/movie.html?id=${movie.movieId}">View Details</a>
        </div>
      </article>
    `).join('');
  } catch (err) {
    console.error(err);
    showMessage('Unable to load movies. Please try again later.');
  }
});

