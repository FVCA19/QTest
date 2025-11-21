document.addEventListener('DOMContentLoaded', async () => {
  const movieForm = document.querySelector('#admin-movie-form');
  const movieAlert = document.querySelector('#admin-movie-alert');
  const movieTableBody = document.querySelector('#admin-movies-body');
  const reviewTableBody = document.querySelector('#admin-reviews-body');
  const reviewAlert = document.querySelector('#admin-review-alert');

  const showAlert = (el, text, variant = 'error') => {
    el.textContent = text;
    el.className = `alert ${variant}`;
    el.classList.remove('hidden');
  };

  const hideAlert = (el) => el.classList.add('hidden');

  const session = await window.CineNoteAuth.requireSession();
  if (!window.CineNoteAuth.isAdmin(session)) {
    window.location.href = '/index.html';
    return;
  }

  const loadMovies = async () => {
    try {
      const movies = await CineNoteApi.listMovies();
      if (!movies.length) {
        movieTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No movies yet.</td></tr>';
        return;
      }
      movieTableBody.innerHTML = movies.map((movie) => `
        <tr data-movie-id="${movie.movieId}">
          <td>${movie.title}</td>
          <td>${movie.year}</td>
          <td>${movie.genre ?? '—'}</td>
          <td><img src="${movie.posterUrl}" alt="${movie.title} poster" style="width:60px;height:auto;border-radius:6px;" /></td>
          <td>${movie.averageRating ?? 'N/A'}</td>
          <td><button class="button danger" data-action="delete">Delete</button></td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Movie load error', err);
      showAlert(movieAlert, err.message || 'Failed to load movies');
    }
  };

  const loadReviews = async () => {
    try {
      const reviews = await CineNoteApi.listAllReviews();
      if (!reviews.length) {
        reviewTableBody.innerHTML = '<tr><td colspan="7" class="empty-state">No reviews yet.</td></tr>';
        return;
      }

      // Sort reviews to show flagged ones first
      const sortedReviews = reviews.sort((a, b) => {
        if (a.flagged && !b.flagged) return -1;
        if (!a.flagged && b.flagged) return 1;
        return (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt);
      });

      // Count flagged reviews
      const flaggedCount = reviews.filter(r => r.flagged).length;
      
      // Update flagged count display
      const flaggedCountEl = document.querySelector('#flagged-count');
      if (flaggedCountEl) {
        flaggedCountEl.textContent = flaggedCount;
        flaggedCountEl.style.display = flaggedCount > 0 ? 'inline' : 'none';
      }

      reviewTableBody.innerHTML = sortedReviews.map((review) => {
        const flaggedClass = review.flagged ? ' class="flagged-review"' : '';
        const flaggedBadge = review.flagged ? '<span class="flag-badge">🚩 FLAGGED</span>' : '';
        const flaggedWords = review.flagged && review.flaggedWords ? 
          `<br><small>Matched words: ${review.flaggedWords.join(', ')}</small>` : '';
        
        return `
          <tr data-movie-id="${review.movieId}" data-review-id="${review.reviewId}"${flaggedClass}>
            <td>${review.movieTitle ?? review.movieId}</td>
            <td>${review.displayName}</td>
            <td>${review.rating}</td>
            <td>${review.comment}${flaggedWords}</td>
            <td>${new Date(review.updatedAt || review.createdAt).toLocaleString()}</td>
            <td>${flaggedBadge}</td>
            <td>
              <button class="button danger" data-action="delete-review">Delete</button>
              ${review.flagged ? '<button class="button secondary" data-action="unflag-review">Unflag</button>' : ''}
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Review load error', err);
      showAlert(reviewAlert, err.message || 'Failed to load reviews');
    }
  };

  await Promise.all([loadMovies(), loadReviews()]);

  movieForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(movieAlert);

    const formData = new FormData(movieForm);
    const payload = Object.fromEntries(formData.entries());

    payload.year = Number.parseInt(payload.year, 10);

    try {
      await CineNoteApi.createMovie(payload);
      movieForm.reset();
      showAlert(movieAlert, 'Movie created successfully', 'success');
      await loadMovies();
    } catch (err) {
      console.error(err);
      showAlert(movieAlert, err.message || 'Failed to create movie');
    }
  });

  movieTableBody.addEventListener('click', async (event) => {
    if (!(event.target instanceof HTMLButtonElement)) return;
    if (event.target.dataset.action !== 'delete') return;
    const row = event.target.closest('tr');
    const movieId = row?.dataset.movieId;
    if (!movieId) return;
    if (!confirm('Delete this movie and its reviews?')) return;
    try {
      await CineNoteApi.deleteMovie(movieId);
      showAlert(movieAlert, 'Movie deleted', 'success');
      await Promise.all([loadMovies(), loadReviews()]);
    } catch (err) {
      console.error(err);
      showAlert(movieAlert, err.message || 'Delete failed');
    }
  });

  reviewTableBody.addEventListener('click', async (event) => {
    if (!(event.target instanceof HTMLButtonElement)) return;
    const action = event.target.dataset.action;
    if (!action || !['delete-review', 'unflag-review'].includes(action)) return;
    
    const row = event.target.closest('tr');
    const movieId = row?.dataset.movieId;
    const reviewId = row?.dataset.reviewId;
    if (!movieId || !reviewId) return;

    if (action === 'delete-review') {
      if (!confirm('Delete this review?')) return;
      try {
        await CineNoteApi.deleteReview(movieId, reviewId);
        showAlert(reviewAlert, 'Review deleted', 'success');
        await Promise.all([loadReviews(), loadMovies()]);
      } catch (err) {
        console.error(err);
        showAlert(reviewAlert, err.message || 'Failed to delete review');
      }
    } else if (action === 'unflag-review') {
      if (!confirm('Remove flag from this review?')) return;
      try {
        await CineNoteApi.unflagReview(movieId, reviewId);
        showAlert(reviewAlert, 'Review unflagged successfully', 'success');
        await loadReviews();
      } catch (err) {
        console.error(err);
        showAlert(reviewAlert, err.message || 'Failed to unflag review');
      }
    }
  });
});

