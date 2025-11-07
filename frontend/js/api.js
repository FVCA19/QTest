const CineNoteApi = (() => {
  const config = window.CINENOTE_CONFIG;
  if (!config) {
    throw new Error('Configuration missing');
  }

  const handleResponse = async (res) => {
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const error = new Error(data?.message || 'Request failed');
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  };

  const authHeaders = async () => {
    const session = await window.CineNoteAuth.getSession();
    if (!session) return {};
    return {
      Authorization: session.idToken
    };
  };

  const request = async (path, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(await authHeaders())
    };
    const res = await fetch(`${config.apiBaseUrl}${path}`, {
      ...options,
      headers
    });
    return handleResponse(res);
  };

  return {
    listMovies: () => request('/movies'),
    getMovie: (movieId) => request(`/movies/${movieId}`),
    getMovieReviews: (movieId) => request(`/movies/${movieId}/reviews`),
    submitReview: (movieId, payload) => request(`/movies/${movieId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
    deleteReview: (movieId, reviewId) => request(`/movies/${movieId}/reviews/${reviewId}`, {
      method: 'DELETE'
    }),
    createMovie: (payload) => request('/movies', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
    deleteMovie: (movieId) => request(`/movies/${movieId}`, {
      method: 'DELETE'
    }),
    listAllReviews: () => request('/reviews')
  };
})();

