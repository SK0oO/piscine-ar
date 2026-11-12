// Faux environnement navigateur pour choisirMode : { navigator, window, document }.
export function creerEnv({ xr = 'absent', getUserMedia = true, quicklook = false } = {}) {
  const appels = { isSessionSupported: [] };
  const navigator = {};
  if (xr === 'supporte') navigator.xr = { isSessionSupported: async (m) => (appels.isSessionSupported.push(m), true) };
  else if (xr === 'non-supporte') navigator.xr = { isSessionSupported: async (m) => (appels.isSessionSupported.push(m), false) };
  else if (xr === 'exception') navigator.xr = { isSessionSupported: async (m) => { appels.isSessionSupported.push(m); throw new Error('SecurityError'); } };
  if (getUserMedia) navigator.mediaDevices = { getUserMedia: async () => ({}) };
  const document = { createElement: () => ({ relList: { supports: (t) => t === 'ar' && quicklook } }) };
  return { env: { navigator, window: {}, document }, appels };
}
