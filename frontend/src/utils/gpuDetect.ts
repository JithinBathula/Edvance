/**
 * Detects Intel Mac GPU and adds 'intel-mac' class to <html>.
 * Intel integrated graphics on macOS have known Chrome compositing bugs
 * triggered by backdrop-filter and stacked filter:blur() elements.
 */
export function applyGPUClass(): void {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return;

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return;

    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string;
    const isIntelMac =
      /Intel/i.test(renderer) &&
      /Mac/i.test(navigator.platform || navigator.userAgent);

    if (isIntelMac) {
      document.documentElement.classList.add('intel-mac');
    }
  } catch {
    // Silently ignore — WebGL may be unavailable in some environments
  }
}
