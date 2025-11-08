const { randomUUID } = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb');

const region = process.env.AWS_REGION || process.env.REGION || 'ap-southeast-2';
const ddbClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const MOVIE_TABLE = process.env.MOVIE_TABLE;
const REVIEW_TABLE = process.env.REVIEW_TABLE;

const response = (statusCode, data) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  },
  body: data ? JSON.stringify(data) : ''
});

const parseBody = (event) => {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch (err) {
    throw new Error('INVALID_JSON');
  }
};

const getClaims = (event) => {
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) return null;
  const groupsClaim = claims['cognito:groups'];
  const groups = groupsClaim ? groupsClaim.split(',') : [];
  return {
    sub: claims.sub,
    email: claims.email,
    username: claims['cognito:username'],
    groups
  };
};

const ensureAuthenticated = (event) => {
  const claims = getClaims(event);
  if (!claims) {
    const error = new Error('UNAUTHENTICATED');
    error.statusCode = 401;
    throw error;
  }
  return claims;
};

const ensureAdmin = (claims) => {
  if (!claims.groups.includes('Admin')) {
    const error = new Error('FORBIDDEN');
    error.statusCode = 403;
    throw error;
  }
};

const withErrorHandling = async (handler, event) => {
  try {
    return await handler();
  } catch (error) {
    console.error('Handler error:', error);
    if (error.statusCode) {
      return response(error.statusCode, { message: error.message });
    }
    if (error.code === 'ConditionalCheckFailedException') {
      return response(409, { message: 'Conflict detected' });
    }
    if (error.message === 'INVALID_JSON') {
      return response(400, { message: 'Invalid JSON body' });
    }
    return response(500, { message: 'Internal server error' });
  }
};

const listMovies = async () => {
  const { Items = [] } = await docClient.send(new ScanCommand({ TableName: MOVIE_TABLE }));
  Items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return response(200, Items.map((item) => ({
    movieId: item.movieId,
    title: item.title,
    year: item.year,
    posterUrl: item.posterUrl,
    averageRating: item.averageRating ?? null,
    description: item.description
  })));
};

const getMovie = async (movieId) => {
  const { Item } = await docClient.send(new GetCommand({
    TableName: MOVIE_TABLE,
    Key: { movieId }
  }));

  if (!Item) {
    return response(404, { message: 'Movie not found' });
  }

  return response(200, Item);
};

const createMovie = async (event) => withErrorHandling(async () => {
  const claims = ensureAuthenticated(event);
  ensureAdmin(claims);
  const { title, year, posterUrl, description } = parseBody(event);

  if (!title || !posterUrl || !description || !year) {
    return response(400, { message: 'Missing required fields' });
  }

  const numericYear = Number.parseInt(year, 10);
  if (Number.isNaN(numericYear) || numericYear < 1888) {
    return response(400, { message: 'Year must be a valid number' });
  }

  const movieId = randomUUID();
  const now = new Date().toISOString();
  const item = {
    movieId,
    title,
    year: numericYear,
    posterUrl,
    description,
    ratingSum: 0,
    ratingCount: 0,
    averageRating: null,
    createdAt: now,
    updatedAt: now
  };

  await docClient.send(new PutCommand({
    TableName: MOVIE_TABLE,
    Item: item,
    ConditionExpression: 'attribute_not_exists(movieId)'
  }));

  return response(201, item);
}, event);

const deleteMovie = async (event, movieId) => withErrorHandling(async () => {
  const claims = ensureAuthenticated(event);
  ensureAdmin(claims);

  const movieRes = await docClient.send(new GetCommand({
    TableName: MOVIE_TABLE,
    Key: { movieId }
  }));

  if (!movieRes.Item) {
    return response(404, { message: 'Movie not found' });
  }

  // Delete reviews for this movie (batch)
  const reviews = await docClient.send(new QueryCommand({
    TableName: REVIEW_TABLE,
    KeyConditionExpression: 'movieId = :movieId',
    ExpressionAttributeValues: { ':movieId': movieId }
  }));

  if (reviews.Items && reviews.Items.length > 0) {
    const chunks = [];
    for (let i = 0; i < reviews.Items.length; i += 25) {
      chunks.push(reviews.Items.slice(i, i + 25));
    }
    await Promise.all(chunks.map((chunk) => docClient.send(new BatchWriteCommand({
      RequestItems: {
        [REVIEW_TABLE]: chunk.map((item) => ({
          DeleteRequest: { Key: { movieId: item.movieId, reviewId: item.reviewId } }
        }))
      }
    }))));
  }

  await docClient.send(new DeleteCommand({
    TableName: MOVIE_TABLE,
    Key: { movieId }
  }));

  return response(200, { message: 'Movie deleted' });
}, event);

const listReviewsForMovie = async (event, movieId) => withErrorHandling(async () => {
  const claims = getClaims(event);

  const { Items = [] } = await docClient.send(new QueryCommand({
    TableName: REVIEW_TABLE,
    KeyConditionExpression: 'movieId = :movieId',
    ExpressionAttributeValues: { ':movieId': movieId }
  }));

  Items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  return response(200, Items.map((item) => ({
    reviewId: item.reviewId,
    authorId: item.userId,
    displayName: item.displayName,
    rating: item.rating,
    comment: item.comment,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    canEdit: claims?.sub === item.userId,
    canDelete: claims?.sub === item.userId || claims?.groups?.includes('Admin')
  })));
}, event);

const upsertReview = async (event, movieId) => withErrorHandling(async () => {
  const claims = ensureAuthenticated(event);
  const { rating, comment } = parseBody(event);

  if (!rating || rating < 1 || rating > 5) {
    return response(400, { message: 'Rating must be between 1 and 5' });
  }

  if (!comment || comment.trim().length === 0) {
    return response(400, { message: 'Comment is required' });
  }

  const movieRes = await docClient.send(new GetCommand({
    TableName: MOVIE_TABLE,
    Key: { movieId }
  }));

  if (!movieRes.Item) {
    return response(404, { message: 'Movie not found' });
  }

  const reviewKey = { movieId, reviewId: claims.sub };
  const existingReview = await docClient.send(new GetCommand({
    TableName: REVIEW_TABLE,
    Key: reviewKey
  }));

  const now = new Date().toISOString();

  await docClient.send(new PutCommand({
    TableName: REVIEW_TABLE,
    Item: {
      movieId,
      reviewId: claims.sub,
      userId: claims.sub,
      displayName: claims.username || claims.email,
      rating,
      comment,
      createdAt: existingReview.Item?.createdAt || now,
      updatedAt: now
    }
  }));

  const previousRating = existingReview.Item ? existingReview.Item.rating : null;
  const ratingSum = movieRes.Item.ratingSum || 0;
  const ratingCount = movieRes.Item.ratingCount || 0;

  const newSum = ratingSum - (previousRating || 0) + rating;
  const newCount = previousRating ? ratingCount : ratingCount + 1;
  const newAverage = newCount === 0 ? null : parseFloat((newSum / newCount).toFixed(2));

  await docClient.send(new UpdateCommand({
    TableName: MOVIE_TABLE,
    Key: { movieId },
    UpdateExpression: 'SET ratingSum = :sum, ratingCount = :count, averageRating = :avg, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':sum': newSum,
      ':count': newCount,
      ':avg': newAverage,
      ':updatedAt': now
    }
  }));

  return response(existingReview.Item ? 200 : 201, {
    movieId,
    reviewId: claims.sub,
    rating,
    comment,
    averageRating: newAverage,
    ratingCount: newCount
  });
}, event);

const deleteReview = async (event, movieId, reviewId) => withErrorHandling(async () => {
  const claims = ensureAuthenticated(event);
  const isAdmin = claims.groups.includes('Admin');
  if (!isAdmin && claims.sub !== reviewId) {
    const error = new Error('FORBIDDEN');
    error.statusCode = 403;
    throw error;
  }

  const reviewKey = { movieId, reviewId };
  const reviewRes = await docClient.send(new GetCommand({
    TableName: REVIEW_TABLE,
    Key: reviewKey
  }));

  if (!reviewRes.Item) {
    return response(404, { message: 'Review not found' });
  }

  const movieRes = await docClient.send(new GetCommand({
    TableName: MOVIE_TABLE,
    Key: { movieId }
  }));

  if (!movieRes.Item) {
    return response(404, { message: 'Movie not found' });
  }

  await docClient.send(new DeleteCommand({
    TableName: REVIEW_TABLE,
    Key: reviewKey
  }));

  const ratingSum = movieRes.Item.ratingSum || 0;
  const ratingCount = movieRes.Item.ratingCount || 0;
  const newSum = Math.max(0, ratingSum - reviewRes.Item.rating);
  const newCount = Math.max(0, ratingCount - 1);
  const newAverage = newCount === 0 ? null : parseFloat((newSum / newCount).toFixed(2));
  const now = new Date().toISOString();

  await docClient.send(new UpdateCommand({
    TableName: MOVIE_TABLE,
    Key: { movieId },
    UpdateExpression: 'SET ratingSum = :sum, ratingCount = :count, averageRating = :avg, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':sum': newSum,
      ':count': newCount,
      ':avg': newAverage,
      ':updatedAt': now
    }
  }));

  return response(200, { message: 'Review deleted', averageRating: newAverage, ratingCount: newCount });
}, event);

const listAllReviews = async (event) => withErrorHandling(async () => {
  const claims = ensureAuthenticated(event);
  ensureAdmin(claims);

  const scanResult = await docClient.send(new ScanCommand({ TableName: REVIEW_TABLE }));
  const items = scanResult.Items || [];
  items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const movieCache = new Map();

  const getMovieTitle = async (movieId) => {
    if (!movieId) return null;
    if (movieCache.has(movieId)) {
      return movieCache.get(movieId);
    }
    try {
      const { Item } = await docClient.send(new GetCommand({
        TableName: MOVIE_TABLE,
        Key: { movieId }
      }));
      const title = Item?.title || null;
      movieCache.set(movieId, title);
      return title;
    } catch (err) {
      console.error('Failed to fetch movie title', movieId, err);
      movieCache.set(movieId, null);
      return null;
    }
  };

  const reviewsWithTitles = await Promise.all(items.map(async (item) => ({
    ...item,
    movieTitle: await getMovieTitle(item.movieId)
  })));

  return response(200, reviewsWithTitles);
}, event);

exports.handler = async (event) => {
  // Preflight support
  if (event.httpMethod === 'OPTIONS') {
    return response(200, null);
  }

  const proxyPath = event.pathParameters?.proxy || '';
  const segments = proxyPath.split('/').filter(Boolean);
  const method = event.httpMethod;

  // GET /movies
  if (method === 'GET' && (segments.length === 0 || (segments.length === 1 && segments[0] === 'movies'))) {
    return listMovies();
  }

  // GET /movies/{id}
  if (method === 'GET' && segments.length === 2 && segments[0] === 'movies') {
    return getMovie(segments[1]);
  }

  // POST /movies
  if (method === 'POST' && segments.length === 1 && segments[0] === 'movies') {
    return createMovie(event);
  }

  // DELETE /movies/{id}
  if (method === 'DELETE' && segments.length === 2 && segments[0] === 'movies') {
    return deleteMovie(event, segments[1]);
  }

  // GET /movies/{id}/reviews
  if (method === 'GET' && segments.length === 3 && segments[0] === 'movies' && segments[2] === 'reviews') {
    return listReviewsForMovie(event, segments[1]);
  }

  // POST /movies/{id}/reviews (create or update own review)
  if (method === 'POST' && segments.length === 3 && segments[0] === 'movies' && segments[2] === 'reviews') {
    return upsertReview(event, segments[1]);
  }

  // DELETE /movies/{id}/reviews/{reviewId}
  if (method === 'DELETE' && segments.length === 4 && segments[0] === 'movies' && segments[2] === 'reviews') {
    return deleteReview(event, segments[1], segments[3]);
  }

  // GET /reviews (admin)
  if (method === 'GET' && segments.length === 1 && segments[0] === 'reviews') {
    return listAllReviews(event);
  }

  return response(404, { message: 'Not found' });
};

