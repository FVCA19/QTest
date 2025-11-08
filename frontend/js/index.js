document.addEventListener('DOMContentLoaded', async () => {
  const listEl = document.querySelector('#movie-grid');
  const messageEl = document.querySelector('#movie-message');
  const landingHero = document.querySelector('#landing-hero');
  const moviesSection = document.querySelector('#movies-section');
  const body = document.body;
  const searchInput = document.querySelector('#filter-search');
  const genreSelect = document.querySelector('#filter-genre');
  const yearMinInput = document.querySelector('#filter-year-min');
  const yearMaxInput = document.querySelector('#filter-year-max');
  const ratingMinInput = document.querySelector('#filter-rating-min');
  const ratingMaxInput = document.querySelector('#filter-rating-max');
  const resetBtn = document.querySelector('#filter-reset');

  let allMovies = [];

  const showMessage = (text) => {
    messageEl.textContent = text;
    messageEl.classList.remove('hidden');
  };

  const renderMovies = (movies) => {
    if (!movies || movies.length === 0) {
      showMessage('No movies match the current filters.');
      listEl.innerHTML = '';
      return;
    }
    messageEl.classList.add('hidden');
    listEl.innerHTML = movies.map((movie) => `
      <article class="card">
        <img src="${movie.posterUrl}" alt="Poster for ${movie.title}" loading="lazy" />
        <div class="card-content">
          <h2>${movie.title}</h2>
          <span class="genre-badge">${movie.genre ?? 'Genre TBD'}</span>
          <p>${movie.year}</p>
          <span class="rating-badge">⭐ ${movie.averageRating ?? 'N/A'}</span>
          <p class="description">${movie.description ?? ''}</p>
          <a class="button secondary" href="/movie.html?id=${movie.movieId}">View Details</a>
        </div>
      </article>
    `).join('');
  };

  const applyFilters = () => {
    let filtered = allMovies.slice();
    const search = searchInput.value.trim().toLowerCase();
    const genre = genreSelect.value;
    const yearMin = Number.parseInt(yearMinInput.value, 10);
    const yearMax = Number.parseInt(yearMaxInput.value, 10);
    const ratingMin = Number.parseFloat(ratingMinInput.value);
    const ratingMax = Number.parseFloat(ratingMaxInput.value);

    if (search) {
      filtered = filtered.filter((movie) => movie.title.toLowerCase().includes(search));
    }

    if (genre) {
      filtered = filtered.filter((movie) => movie.genre === genre);
    }

    if (!Number.isNaN(yearMin)) {
      filtered = filtered.filter((movie) => movie.year >= yearMin);
    }

    if (!Number.isNaN(yearMax)) {
      filtered = filtered.filter((movie) => movie.year <= yearMax);
    }

    if (!Number.isNaN(ratingMin)) {
      filtered = filtered.filter((movie) => (movie.averageRating ?? 0) >= ratingMin);
    }

    if (!Number.isNaN(ratingMax)) {
      filtered = filtered.filter((movie) => (movie.averageRating ?? 0) <= ratingMax);
    }

    renderMovies(filtered);
  };

  const session = await window.CineNoteAuth.getSession();
  if (!session) {
    body.classList.add('landing-mode');
    landingHero.classList.remove('hidden');
    moviesSection.classList.add('hidden');
    return;
  }

  body.classList.remove('landing-mode');
  landingHero.classList.add('hidden');
  moviesSection.classList.remove('hidden');

  try {
    const movies = await CineNoteApi.listMovies();
    if (!movies || movies.length === 0) {
      showMessage('No movies yet. Check back soon.');
      listEl.innerHTML = '';
      return;
    }
    allMovies = movies;
    applyFilters();
  } catch (err) {
    console.error(err);
    showMessage('Unable to load movies. Please try again later.');
  }

  const inputs = [searchInput, genreSelect, yearMinInput, yearMaxInput, ratingMinInput, ratingMaxInput];
  inputs.forEach((input) => {
    if (!input) return;
    const eventName = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(eventName, applyFilters);
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      searchInput.value = '';
      genreSelect.value = '';
      yearMinInput.value = '';
      yearMaxInput.value = '';
      ratingMinInput.value = '';
      ratingMaxInput.value = '';
      applyFilters();
    });
  }
});

