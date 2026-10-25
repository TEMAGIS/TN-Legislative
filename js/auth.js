// ════════════════════════════════════════════════════════════════
//  AUTH — OAuth 2.0 authorization-code + PKCE against ArcGIS Online.
//  Same pattern as the PREDS Summary app: no client secret, silent
//  refresh, popup flow when embedded in an iframe (Experience Builder).
// ════════════════════════════════════════════════════════════════
const Auth = (() => {
  let TOKEN = null;
  let refreshInFlight = null;
  let preparedAuthUrl = null;
  const C = () => window.CONFIG;
  const redirectUri = () => C().redirectUri || (location.origin + location.pathname.replace(/index\.html$/, ''));

  const b64url = (buf) => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = ''; bytes.forEach(b => s += String.fromCharCode(b));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const rand = (n = 48) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); };
  const sha256 = async (s) => b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
  const inIframe = () => { try { return window.self !== window.top; } catch { return true; } };

  function load() {
    try {
      const t = JSON.parse(localStorage.getItem(C().tokenKey) || 'null');
      if (t && t.accessToken && t.expiresAt) { TOKEN = t; return t; }
    } catch {}
    return null;
  }
  function save(t) { TOKEN = t; try { localStorage.setItem(C().tokenKey, JSON.stringify(t)); } catch {} }
  function clear() {
    TOKEN = null;
    try { localStorage.removeItem(C().tokenKey); } catch {}
    sessionStorage.removeItem('oauth_verifier'); sessionStorage.removeItem('oauth_state');
  }
  function fromResponse(d) {
    const now = Date.now();
    const exp = Number(d.expires_in) || 7200, ref = Number(d.refresh_token_expires_in) || 0;
    return {
      accessToken: d.access_token,
      refreshToken: d.refresh_token || (TOKEN && TOKEN.refreshToken) || null,
      expiresAt: now + exp * 1000,
      refreshExpiresAt: ref ? now + ref * 1000 : (TOKEN && TOKEN.refreshExpiresAt) || null,
      username: d.username || (TOKEN && TOKEN.username) || null,
    };
  }

  async function buildAuthorizeUrl() {
    const verifier = rand(48), state = rand(16);
    sessionStorage.setItem('oauth_verifier', verifier);
    sessionStorage.setItem('oauth_state', state);
    const p = new URLSearchParams({
      client_id: C().clientId, response_type: 'code', redirect_uri: redirectUri(),
      code_challenge: await sha256(verifier), code_challenge_method: 'S256',
      expiration: String(C().tokenExpirationMinutes), state,
    });
    return `${C().authorizeUrl}?${p}`;
  }

  async function tokenRequest(params) {
    const res = await fetch(C().tokenUrl, { method: 'POST', body: new URLSearchParams({ ...params, client_id: C().clientId, f: 'json' }) });
    const d = await res.json();
    if (d.error) throw new Error((d.error.details && d.error.details[0]) || d.error.message || 'Sign-in failed');
    if (!d.access_token) throw new Error('No access token returned');
    return fromResponse(d);
  }
  async function exchange(code) {
    const verifier = sessionStorage.getItem('oauth_verifier');
    if (!verifier) throw new Error('Missing PKCE verifier — please sign in again.');
    const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: verifier });
    sessionStorage.removeItem('oauth_verifier'); sessionStorage.removeItem('oauth_state');
    return t;
  }
  async function refresh() {
    if (!TOKEN || !TOKEN.refreshToken) throw new Error('No refresh token');
    if (TOKEN.refreshExpiresAt && Date.now() > TOKEN.refreshExpiresAt) throw new Error('Refresh token expired');
    return tokenRequest({ grant_type: 'refresh_token', refresh_token: TOKEN.refreshToken });
  }
  async function ensureFresh() {
    if (!TOKEN) throw new Error('Not signed in');
    if (TOKEN.expiresAt && Date.now() < TOKEN.expiresAt - C().refreshBufferMs) return;
    if (!refreshInFlight) refreshInFlight = refresh().then(save).finally(() => { refreshInFlight = null; });
    return refreshInFlight;
  }

  // Start sign-in. Standalone → full-page redirect. Embedded → popup + postMessage.
  function start(onError, onSignedIn) {
    if (inIframe()) {
      const w = 540, h = 720;
      const popup = window.open('about:blank', 'leg_oauth',
        `width=${w},height=${h},left=${Math.max(0, (screen.width - w) / 2)},top=${Math.max(0, (screen.height - h) / 2)}`);
      if (!popup) return onError('Popup was blocked — allow popups for this site, then try again.');
      (preparedAuthUrl ? Promise.resolve(preparedAuthUrl) : buildAuthorizeUrl())
        .then(u => { popup.location.href = u; })
        .catch(e => { try { popup.close(); } catch {} onError('Could not start sign-in. ' + e.message); });
      const onMsg = async (ev) => {
        if (ev.origin !== location.origin || !ev.data || ev.data.type !== 'leg_oauth') return;
        window.removeEventListener('message', onMsg);
        if (ev.data.error) return onError(ev.data.error_description || ev.data.error);
        try { save(await exchange(ev.data.code)); onSignedIn(); } catch (e) { onError(e.message); }
      };
      window.addEventListener('message', onMsg);
    } else {
      buildAuthorizeUrl().then(u => { location.href = u; }).catch(e => onError('Could not start sign-in. ' + e.message));
    }
  }

  // Returns true when this page load consumed an OAuth redirect.
  async function handleCallback(onError) {
    const url = new URL(location.href);
    const code = url.searchParams.get('code'), state = url.searchParams.get('state'), error = url.searchParams.get('error');
    if (!code && !error) return false;
    if (window.opener && window.opener !== window) {
      try {
        window.opener.postMessage({ type: 'leg_oauth', code, state, error, error_description: url.searchParams.get('error_description') }, location.origin);
      } catch {}
      setTimeout(() => { try { window.close(); } catch {} }, 50);
      document.body.innerHTML = '<p style="font-family:system-ui;padding:40px;text-align:center">Sign-in complete. You can close this window.</p>';
      return true;
    }
    history.replaceState({}, '', url.pathname);
    if (error) { onError('Sign-in error: ' + (url.searchParams.get('error_description') || error)); return false; }
    const expected = sessionStorage.getItem('oauth_state');
    if (expected && state !== expected) { onError('Sign-in failed: state mismatch. Please try again.'); return false; }
    try { save(await exchange(code)); return true; }
    catch (e) { onError(e.message || 'Sign-in failed.'); return false; }
  }

  async function prepareFallbackLink(el) {
    if (!el) return;
    if (!inIframe()) { el.hidden = true; return; }
    try { preparedAuthUrl = await buildAuthorizeUrl(); el.href = preparedAuthUrl; el.hidden = false; } catch {}
  }

  return {
    load, save, clear, start, handleCallback, ensureFresh, refresh, prepareFallbackLink,
    get token() { return TOKEN; },
    get accessToken() { return TOKEN && TOKEN.accessToken; },
    get username() { return TOKEN && TOKEN.username; },
    get redirectUri() { return redirectUri(); },
  };
})();
