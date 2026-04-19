export interface NavigateResult {
  success: boolean;
  error?: string;
}

export function navigateTo(url: string): NavigateResult {
  try {
    window.location.href = url;
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function goBack(): NavigateResult {
  history.back();
  return { success: true };
}

export function goForward(): NavigateResult {
  history.forward();
  return { success: true };
}

export type ScrollDirection = 'top' | 'bottom' | 'up' | 'down';

export function scrollPage(direction: ScrollDirection, amount?: number): void {
  const px = amount ?? Math.round(window.innerHeight * 0.75);

  switch (direction) {
    case 'top':
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    case 'bottom':
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      break;
    case 'up':
      window.scrollBy({ top: -px, behavior: 'smooth' });
      break;
    case 'down':
      window.scrollBy({ top: px, behavior: 'smooth' });
      break;
  }
}

export function scrollToElement(selector: string): NavigateResult {
  const el = document.querySelector(selector);
  if (!el) return { success: false, error: `Element not found: ${selector}` };
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return { success: true };
}
