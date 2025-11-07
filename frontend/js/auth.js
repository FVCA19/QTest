(function () {
  const config = window.CINENOTE_CONFIG;

  if (!config) {
    console.error('CINENOTE_CONFIG is missing. Please set frontend/js/config.js');
    return;
  }

  AWS.config.region = config.region;

  const poolData = {
    UserPoolId: config.userPoolId,
    ClientId: config.userPoolWebClientId
  };

  const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

  const decodeJwt = (token) => {
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (err) {
      console.error('Failed to decode JWT', err);
      return null;
    }
  };

  const storageKey = 'cinenote_session_v1';

  const setSession = (session) => {
    if (session) {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(storageKey);
    }
  };

  const getStoredSession = () => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.warn('Failed to parse stored session', err);
      return null;
    }
  };

  const buildSessionPayload = (cognitoSession) => {
    const idToken = cognitoSession.getIdToken().getJwtToken();
    const accessToken = cognitoSession.getAccessToken().getJwtToken();
    const refreshToken = cognitoSession.getRefreshToken().getToken();
    const payload = decodeJwt(idToken) || {};

    return {
      idToken,
      accessToken,
      refreshToken,
      payload,
      issuedAt: Date.now()
    };
  };

  const refreshCurrentSession = () => new Promise((resolve, reject) => {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      setSession(null);
      return resolve(null);
    }
    cognitoUser.getSession((err, session) => {
      if (err || !session || !session.isValid()) {
        setSession(null);
        return reject(err || new Error('Session invalid'));
      }
      cognitoUser.refreshSession(session.getRefreshToken(), (refreshErr, refreshedSession) => {
        if (refreshErr) {
          setSession(null);
          return reject(refreshErr);
        }
        const payload = buildSessionPayload(refreshedSession);
        setSession(payload);
        resolve(payload);
      });
    });
  });

  const auth = {
    registerUser: ({ username, email, password }) => new Promise((resolve, reject) => {
      const trimmedUsername = (username || '').trim();
      if (!trimmedUsername) {
        return reject(new Error('Username is required'));
      }
      const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({
          Name: 'email',
          Value: email
        })
      ];
      attributeList.push(new AmazonCognitoIdentity.CognitoUserAttribute({
        Name: 'preferred_username',
        Value: trimmedUsername
      }));
      userPool.signUp(trimmedUsername, password, attributeList, null, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    }),

    confirmRegistration: ({ username, code }) => new Promise((resolve, reject) => {
      const trimmedUsername = (username || '').trim();
      if (!trimmedUsername) {
        return reject(new Error('Username is required'));
      }
      const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
        Username: trimmedUsername,
        Pool: userPool
      });
      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    }),

    resendConfirmationCode: ({ username }) => new Promise((resolve, reject) => {
      const trimmedUsername = (username || '').trim();
      if (!trimmedUsername) {
        return reject(new Error('Username is required'));
      }
      const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
        Username: trimmedUsername,
        Pool: userPool
      });
      cognitoUser.resendConfirmationCode((err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    }),

    login: ({ email, password }) => new Promise((resolve, reject) => {
      const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
        Username: email,
        Password: password
      });

      const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
        Username: email,
        Pool: userPool
      });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session) => {
          const payload = buildSessionPayload(session);
          setSession(payload);
          resolve(payload);
        },
        onFailure: reject,
        newPasswordRequired: () => reject(new Error('New password required. Complete challenge in Cognito.'))
      });
    }),

    logout: () => {
      const cognitoUser = userPool.getCurrentUser();
      if (cognitoUser) {
        cognitoUser.signOut();
      }
      setSession(null);
    },

    getSession: async () => {
      const stored = getStoredSession();
      if (!stored) {
        return null;
      }
      const expiry = stored.payload?.exp ? stored.payload.exp * 1000 : 0;
      if (expiry && expiry > Date.now() + 60_000) {
        return stored;
      }
      try {
        const refreshed = await refreshCurrentSession();
        return refreshed;
      } catch (err) {
        console.warn('Refresh session failed', err);
        return null;
      }
    },

    requireSession: async () => {
      const session = await auth.getSession();
      if (!session) {
        window.location.href = '/login.html';
        throw new Error('AUTH_REQUIRED');
      }
      return session;
    },

    isAdmin: (session) => {
      const payload = session?.payload;
      const groups = payload?.['cognito:groups'];
      if (!groups) return false;
      if (Array.isArray(groups)) return groups.includes('Admin');
      if (typeof groups === 'string') return groups.split(',').includes('Admin');
      return false;
    }
  };

  window.CineNoteAuth = auth;
})();

