export async function choisirMode(env) {
  let ra = false;
  try {
    ra = Boolean(await env.navigator.xr?.isSessionSupported('immersive-ar'));
  } catch {
    ra = false;
  }
  let mode;
  if (ra) mode = 'webxr';
  else if (typeof env.navigator.mediaDevices?.getUserMedia === 'function') mode = 'camera-gyro';
  else mode = 'sans-camera';

  let quicklook = false;
  try {
    quicklook = Boolean(env.document.createElement('a').relList?.supports('ar'));
  } catch {
    quicklook = false;
  }
  return { mode, quicklook: mode === 'webxr' ? false : quicklook };
}
