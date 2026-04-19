export interface FillResult {
  success: boolean;
  error?: string;
}

export interface FormFillResult {
  success: boolean;
  filled: number;
  errors: string[];
}

type InputEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type FillableEl = InputEl | HTMLElement; // HTMLElement covers contenteditable divs

function setNativeValue(el: InputEl, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  descriptor?.set?.call(el, value);

  el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function isContentEditable(el: Element): el is HTMLElement {
  return (el as HTMLElement).isContentEditable === true;
}

function setContentEditableValue(el: HTMLElement, value: string): void {
  el.focus();
  // Select all existing text
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  sel?.removeAllRanges();
  sel?.addRange(range);
  // Replace with the new value via execCommand so React/Vue see the change
  document.execCommand('insertText', false, value);
  // Fallback: directly set and fire events
  if (!el.textContent?.includes(value)) {
    el.textContent = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

export function pressEnter(el: HTMLElement): void {
  const init: KeyboardEventInit = { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true };
  el.dispatchEvent(new KeyboardEvent('keydown', init));
  el.dispatchEvent(new KeyboardEvent('keypress', init));
  el.dispatchEvent(new KeyboardEvent('keyup', init));
  const form = (el as HTMLInputElement).form;
  if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

/** Returns true if the element is visible on the page */
function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

/**
 * Fuzzy-find an input/textarea/select/contenteditable using multiple strategies.
 * Priority: CSS selector → id → name attr → placeholder → aria-label → label text
 */
function fuzzyFindInput(hint: string): FillableEl | null {
  // 1. Exact CSS selector — also try contenteditable
  try {
    const bySelector = document.querySelector<HTMLElement>(hint);
    if (bySelector && isVisible(bySelector)) return bySelector;
  } catch { /* invalid selector */ }

  const lower = hint.toLowerCase().replace(/^#/, '');

  // All candidate inputs (including contenteditable)
  const standardInputs = Array.from(
    document.querySelectorAll<InputEl>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'
    )
  ).filter(isVisible);

  const editables = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[contenteditable="true"], [role="textbox"], [role="combobox"]'
    )
  ).filter(isVisible);

  const candidates: FillableEl[] = [...standardInputs, ...editables];

  // 2. id exact
  for (const el of candidates) {
    if (el.id.toLowerCase() === lower) return el;
  }

  // 3. name attr exact
  for (const el of candidates) {
    if ((el.getAttribute('name') ?? '').toLowerCase() === lower) return el;
  }

  // 4. placeholder contains
  for (const el of candidates) {
    if ((el.getAttribute('placeholder') ?? '').toLowerCase().includes(lower)) return el;
  }

  // 5. aria-label contains
  for (const el of candidates) {
    if ((el.getAttribute('aria-label') ?? '').toLowerCase().includes(lower)) return el;
  }

  // 6. Associated <label> text contains
  for (const el of candidates) {
    let labelText = '';
    if (el.id) {
      const lbl = document.querySelector<HTMLLabelElement>(`label[for="${el.id}"]`);
      if (lbl) labelText = lbl.innerText.toLowerCase();
    }
    if (!labelText) {
      const wrappingLabel = el.closest('label');
      if (wrappingLabel) labelText = (wrappingLabel as HTMLElement).innerText.toLowerCase();
    }
    if (labelText.includes(lower)) return el;
  }

  // 7. aria-labelledby
  for (const el of candidates) {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const lblEl = document.getElementById(labelledBy);
      if (lblEl && (lblEl as HTMLElement).innerText.toLowerCase().includes(lower)) return el;
    }
  }

  // 8. data-testid or class contains
  for (const el of candidates) {
    const testId = el.getAttribute('data-testid') ?? '';
    const cls = el.className ?? '';
    if (testId.toLowerCase().includes(lower) || cls.toLowerCase().includes(lower)) return el;
  }

  // 9. Last resort: the only visible input on the page
  if (candidates.length === 1) return candidates[0];

  return null;
}

export function fillInput(hint: string, value: string, submit = false): FillResult {
  const el = fuzzyFindInput(hint);
  if (!el) {
    return {
      success: false,
      error: `Input not found: "${hint}". Try using the label text, placeholder, id, or name of the field.`,
    };
  }

  try {
    el.focus();

    if (el instanceof HTMLSelectElement) {
      const option = Array.from(el.options).find(
        (o) =>
          o.value.toLowerCase() === value.toLowerCase() ||
          o.text.toLowerCase() === value.toLowerCase()
      );
      if (option) {
        setNativeValue(el, option.value);
      } else {
        return { success: false, error: `Option "${value}" not found in select` };
      }
    } else if (isContentEditable(el)) {
      setContentEditableValue(el, value);
      if (submit) pressEnter(el);
    } else {
      setNativeValue(el as InputEl, value);
      if (submit) pressEnter(el as HTMLElement);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function fillForm(fields: Record<string, string>): FormFillResult {
  const errors: string[] = [];
  let filled = 0;

  for (const [hint, value] of Object.entries(fields)) {
    const result = fillInput(hint, value);
    if (result.success) {
      filled++;
    } else {
      errors.push(result.error ?? 'Unknown error');
    }
  }

  return { success: errors.length === 0, filled, errors };
}
