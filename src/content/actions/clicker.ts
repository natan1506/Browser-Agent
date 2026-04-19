export interface ClickResult {
  success: boolean;
  error?: string;
}

/** Returns true if the element is visible and interactable */
function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function doClick(el: HTMLElement): void {
  el.focus();
  el.click();
  // Dispatch a synthetic MouseEvent as well for frameworks that listen to it
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }));
}

export function clickBySelector(selector: string): ClickResult {
  try {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el || !isVisible(el)) {
      return { success: false, error: `No visible element found for selector: ${selector}` };
    }
    doClick(el);
    return { success: true };
  } catch {
    return { success: false, error: `Invalid selector: ${selector}` };
  }
}

export function clickByText(text: string, exact = false): ClickResult {
  // Wide net: any element that might be clickable
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'a, button, [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"],' +
      ' input[type="submit"], input[type="button"], input[type="reset"],' +
      ' label, li, span, div, p, td, th'
    )
  ).filter(isVisible);

  const lower = text.toLowerCase().trim();

  const score = (el: HTMLElement): number => {
    const elText = (el.innerText ?? el.textContent ?? '').trim().toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') ?? '').toLowerCase();
    const title = (el.getAttribute('title') ?? '').toLowerCase();
    const value = (el.getAttribute('value') ?? '').toLowerCase();

    if (exact) {
      if (elText === lower || ariaLabel === lower || title === lower || value === lower) return 3;
      return 0;
    }
    if (elText === lower || ariaLabel === lower) return 3;
    if (elText.includes(lower) || ariaLabel.includes(lower)) return 2;
    if (title.includes(lower) || value.includes(lower)) return 1;
    return 0;
  };

  // Sort by score desc, prefer semantically clickable elements
  const SEMANTIC_TAGS = new Set(['a', 'button', 'input', 'label']);
  const ranked = candidates
    .map((el) => ({ el, score: score(el) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aIsClick = SEMANTIC_TAGS.has(a.el.tagName.toLowerCase()) ? 1 : 0;
      const bIsClick = SEMANTIC_TAGS.has(b.el.tagName.toLowerCase()) ? 1 : 0;
      return bIsClick - aIsClick;
    });

  if (!ranked.length) {
    return { success: false, error: `No clickable element found with text: "${text}"` };
  }

  doClick(ranked[0].el);
  return { success: true };
}

export function clickByAriaLabel(label: string): ClickResult {
  const lower = label.toLowerCase();

  // Try exact first, then partial
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('[aria-label]')
  ).filter(isVisible);

  const exact = candidates.find(
    (el) => (el.getAttribute('aria-label') ?? '').toLowerCase() === lower
  );
  if (exact) { doClick(exact); return { success: true }; }

  const partial = candidates.find(
    (el) => (el.getAttribute('aria-label') ?? '').toLowerCase().includes(lower)
  );
  if (partial) { doClick(partial); return { success: true }; }

  return { success: false, error: `No element with aria-label containing: "${label}"` };
}
