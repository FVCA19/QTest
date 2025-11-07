const qsParam = (key) => new URLSearchParams(window.location.search).get(key);

document.addEventListener('DOMContentLoaded', async () => {
  const movieId = qsParam('id');
  if (!movieId) {
    window.location.href = '/index.html';
    return;
  }

  const titleEl = document.querySelector('#movie-title');
  const yearEl = document.querySelector('#movie-year');
  const descEl = document.querySelector('#movie-description');
  const posterEl = document.querySelector('#movie-poster');
  const avgRatingEl = document.querySelector('#movie-average');
  const reviewListEl = document.querySelector('#review-list');
  const reviewForm = document.querySelector('#review-form');
  const ratingInput = document.querySelector('#review-rating');
  const commentInput = document.querySelector('#review-comment');
  const reviewAlert = document.querySelector('#review-alert');

  let currentSession = await window.CineNoteAuth.getSession();
  let existingReviewId = null;

  const showAlert = (text, variant = 'error') => {
    reviewAlert.textContent = text;
    reviewAlert.className = `alert ${variant}`;
    reviewAlert.classList.remove('hidden');
  };

  const hideAlert = () => {
    reviewAlert.classList.add('hidden');
  };

  const renderMovie = (movie) => {
    titleEl.textContent = movie.title;
    yearEl.textContent = movie.year;
    descEl.textContent = movie.description;
    posterEl.src = movie.posterUrl;
    avgRatingEl.textContent = movie.averageRating ?? 'Unrated';
  };

  const renderReviews = (reviews = []) => {
    if (reviews.length === 0) {
      reviewListEl.innerHTML = '<p class="empty-state">No reviews yet. Be the first to share your thoughts.</p>';
      return;
    }

    reviewListEl.innerHTML = reviews.map((review) => {
      const canEdit = review.canEdit;
      const canDelete = review.canDelete;
      return `
        <div class="review" data-review-id="${review.reviewId}">
          <div class="review-header">
            <strong>${review.displayName}</strong>
            <span>⭐ ${review.rating}</span>
          </div>
          <p>${review.comment}</p>
          <small>Updated ${new Date(review.updatedAt || review.createdAt).toLocaleString()}</small>
          ${canDelete ? `
            <div class="review-actions">
              <button class="button danger" data-action="delete">Delete</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  };

  const loadReviews = async () => {
    try {
      const reviews = await CineNoteApi.getMovieReviews(movieId);
      renderReviews(reviews);

      if (currentSession) {
        const myReview = reviews.find((review) => review.canEdit);
        if (myReview) {
          existingReviewId = myReview.reviewId;
          ratingInput.value = myReview.rating;
          commentInput.value = myReview.comment;
          reviewForm.querySelector('button[type="submit"]').textContent = 'Update Review';
        }
      }
    } catch (err) {
      console.error('Failed to load reviews', err);
      renderReviews();
    }
  };

  try {
    const movie = await CineNoteApi.getMovie(movieId);
    renderMovie(movie);
  } catch (err) {
    console.error('Failed to load movie', err);
    window.location.href = '/index.html';
    return;
  }

  await loadReviews();

  if (!currentSession) {
    reviewForm.classList.add('hidden');
    document.querySelector('#review-login-prompt').classList.remove('hidden');
  }

  reviewForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert();
    currentSession = await window.CineNoteAuth.requireSession();

    const payload = {
      rating: Number.parseInt(ratingInput.value, 10),
      comment: commentInput.value.trim()
    };

    try {
      const result = await CineNoteApi.submitReview(movieId, payload);
      avgRatingEl.textContent = result.averageRating ?? 'Unrated';
      await loadReviews();
      showAlert(existingReviewId ? 'Review updated!' : 'Review posted!', 'success');
      existingReviewId = result.reviewId;
    } catch (err) {
      console.error(err);
      showAlert(err.message || 'Unable to submit review');
    }
  });

  reviewListEl.addEventListener('click', async (event) => {
    if (!(event.target instanceof HTMLButtonElement)) return;
    const action = event.target.dataset.action;
    const reviewEl = event.target.closest('.review');
    if (!action || !reviewEl) return;
    const reviewId = reviewEl.dataset.reviewId;

    if (action === 'delete') {
      if (!confirm('Delete this review?')) return;
      try {
        const result = await CineNoteApi.deleteReview(movieId, reviewId);
        avgRatingEl.textContent = result.averageRating ?? 'Unrated';
        await loadReviews();
        showAlert('Review deleted', 'success');
      } catch (err) {
        console.error(err);
        showAlert(err.message || 'Unable to delete review');
      }
    }
  });
});

