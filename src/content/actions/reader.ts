export interface InteractiveElement {
  tag: string;
  type?: string;
  selector: string;   // best CSS selector to target this element
  label?: string;     // associated <label> text
  placeholder?: string;
  ariaLabel?: string;
  name?: string;
  id?: string;
  value?: string;     // current value (inputs/selects)
  text?: string;      // visible text (buttons/links)
}

export interface PageContent {
  title: string;
  url: string;
  description: string;
  content: string;
  headings: string[];
  interactive: InteractiveElement[];
}

/** Build the most specific unique CSS selector for an element */
function bestSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.getAttribute('name')) {
    const name = el.getAttribute('name')!;
    const tag = el.tagName.toLowerCase();
    const byName = document.querySelectorAll(`${tag}[name="${name}"]`);
    if (byName.length === 1) return `${tag}[name="${CSS.escape(name)}"]`;
  }
  if (el.getAttribute('data-testid')) {
    return `[data-testid="${CSS.escape(el.getAttribute('data-testid')!)}"]`;
  }
  if (el.getAttribute('placeholder')) {
    const ph = el.getAttribute('placeholder')!;
    const byPh = document.querySelectorAll(`[placeholder="${ph}"]`);
    if (byPh.length === 1) return `[placeholder="${CSS.escape(ph)}"]`;
  }
  if (el.getAttribute('aria-label')) {
    const al = el.getAttribute('aria-label')!;
    const byAl = document.querySelectorAll(`[aria-label="${al}"]`);
    if (byAl.length === 1) return `[aria-label="${CSS.escape(al)}"]`;
  }
  // nth-of-type fallback
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (c) => c.tagName === el.tagName
    );
    const idx = siblings.indexOf(el) + 1;
    const parentSel = bestSelector(parent);
    return `${parentSel} > ${tag}:nth-of-type(${idx})`;
  }
  return tag;
}

/** Find the label text associated with a form element */
function findLabel(el: Element): string | undefined {
  // Explicit <label for="id">
  if (el.id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${el.id}"]`);
    if (label) return label.innerText.trim();
  }
  // Wrapping <label>
  const parent = el.closest('label');
  if (parent) {
    const clone = parent.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input,select,textarea').forEach((c) => c.remove());
    const text = clone.innerText.trim();
    if (text) return text;
  }
  // aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return (labelEl as HTMLElement).innerText.trim();
  }
  return undefined;
}

/** Collect all visible interactive elements on the page */
function getInteractiveElements(): InteractiveElement[] {
  const results: InteractiveElement[] = [];

  // Inputs & textareas
  const inputSel = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select';
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(inputSel)
    .forEach((el) => {
      // Skip invisible elements
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;

      const item: InteractiveElement = {
        tag: el.tagName.toLowerCase(),
        selector: bestSelector(el),
        label: findLabel(el),
        placeholder: el.getAttribute('placeholder') ?? undefined,
        ariaLabel: el.getAttribute('aria-label') ?? undefined,
        name: el.getAttribute('name') ?? undefined,
        id: el.id || undefined,
      };

      if (el instanceof HTMLInputElement) {
        item.type = el.type;
        item.value = el.value || undefined;
      } else if (el instanceof HTMLSelectElement) {
        item.type = 'select';
        item.value = el.value || undefined;
      }

      results.push(item);
    });

  // Contenteditable elements (e.g. ChatGPT, rich-text editors)
  document.querySelectorAll<HTMLElement>(
    '[contenteditable="true"], [role="textbox"]:not(input):not(textarea)'
  ).forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;

    results.push({
      tag: el.tagName.toLowerCase(),
      type: 'contenteditable',
      selector: bestSelector(el),
      ariaLabel: el.getAttribute('aria-label') ?? undefined,
      placeholder: el.getAttribute('placeholder') ?? (el.getAttribute('data-placeholder') ?? undefined),
      label: findLabel(el),
      id: el.id || undefined,
    });
  });

  // Buttons & links (limit to 30)
  const clickSel = 'button, [role="button"], input[type="submit"], input[type="button"], a[href]';
  let btnCount = 0;
  document.querySelectorAll<HTMLElement>(clickSel).forEach((el) => {
    if (btnCount >= 30) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;

    const text = el.innerText?.trim() || el.getAttribute('value') || el.getAttribute('aria-label') || '';
    if (!text) return;

    results.push({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') ?? (el.tagName === 'A' ? 'link' : 'button'),
      selector: bestSelector(el),
      ariaLabel: el.getAttribute('aria-label') ?? undefined,
      text: text.slice(0, 60),
    });
    btnCount++;
  });

  return results;
}

export function readPage(): PageContent {
  const title = document.title;
  const url = window.location.href;

  const metaDesc = document.querySelector<HTMLMetaElement>(
    'meta[name="description"], meta[property="og:description"]'
  );
  const description = metaDesc?.content ?? '';

  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map((el) => (el as HTMLElement).innerText.trim())
    .filter(Boolean)
    .slice(0, 20);

  const mainEl =
    document.querySelector<HTMLElement>('main, article, [role="main"]') ??
    document.body;

  const clone = mainEl.cloneNode(true) as HTMLElement;
  const noiseSelectors = [
    'script', 'style', 'nav', 'footer', 'header', 'aside',
    'noscript', 'iframe', '.cookie-banner', '[aria-hidden="true"]',
  ];
  noiseSelectors.forEach((sel) => {
    clone.querySelectorAll(sel).forEach((el) => el.remove());
  });

  const content = clone.innerText
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 8000); // slightly shorter to make room for interactive map

  const interactive = getInteractiveElements();

  return { title, url, description, content, headings, interactive };
}
