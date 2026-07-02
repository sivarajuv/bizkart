// Native (Capacitor) app bootstrap.
//
// This file is a no-op when the app runs as a normal website (Capacitor isn't
// present / isNativePlatform() is false), so it's always safe to import from
// index.js regardless of how the app is being served.
//
// It wires up three things that a wrapped web app needs to actually feel like
// a native app on Android/iOS instead of "a website in a box":
//   1. Hide the native splash screen once React has painted the first frame.
//   2. Style the status bar to match the BizKart brand color.
//   3. Make the Android hardware/gesture back button navigate back within the
//      app (like a browser back) instead of instantly exiting the app on any
//      screen that isn't the landing page.

export async function initNativeApp() {
  let Capacitor;
  try {
    ({ Capacitor } = await import('@capacitor/core'));
  } catch {
    return; // @capacitor/core not installed in this build — nothing to do.
  }

  if (!Capacitor.isNativePlatform()) return;

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {}

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setBackgroundColor({ color: '#16a34a' });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {}

  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      // The app's router (IntegratedApp.jsx) uses window.history.pushState for
      // /, /shop, /admin, /s/:slug navigation, so browser-style back is exactly
      // what history.back() gives us. Only exit the app from the true root.
      if (canGoBack && window.location.pathname !== '/') {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch {}
}
