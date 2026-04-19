import { readPage } from './actions/reader';
import { clickBySelector, clickByText, clickByAriaLabel } from './actions/clicker';
import { fillInput, fillForm } from './actions/filler';
import { navigateTo, goBack, goForward, scrollPage, scrollToElement } from './actions/navigator';
import { scrapeElements, scrapeTable, scrapeLinks, scrapeMetadata } from './actions/scraper';
import type { ContentAction, ActionResult } from '../shared/types';

chrome.runtime.onMessage.addListener(
  (action: ContentAction, _sender, sendResponse: (result: ActionResult) => void) => {
    handleAction(action)
      .then(sendResponse)
      .catch((err) =>
        sendResponse({ success: false, error: String(err) })
      );

    // Return true to keep the message channel open for async response
    return true;
  }
);

async function handleAction(action: ContentAction): Promise<ActionResult> {
  const p = action.params;

  switch (action.type) {
    case 'read': {
      const data = readPage();
      return { success: true, data };
    }

    case 'click': {
      if (typeof p['text'] === 'string') {
        return clickByText(p['text'], p['exact'] === true);
      }
      if (typeof p['ariaLabel'] === 'string') {
        return clickByAriaLabel(p['ariaLabel']);
      }
      if (typeof p['selector'] === 'string') {
        return clickBySelector(p['selector']);
      }
      return { success: false, error: 'click requires selector, text, or ariaLabel param' };
    }

    case 'fill': {
      if (p['fields'] && typeof p['fields'] === 'object') {
        const data = fillForm(p['fields'] as Record<string, string>);
        return { success: data.success, data };
      }
      if (typeof p['selector'] === 'string' && typeof p['value'] === 'string') {
        return fillInput(p['selector'], p['value'], p['submit'] === true);
      }
      return { success: false, error: 'fill requires fields map or selector+value params' };
    }

    case 'navigate': {
      if (typeof p['url'] === 'string') {
        return navigateTo(p['url']);
      }
      if (p['back']) { goBack(); return { success: true }; }
      if (p['forward']) { goForward(); return { success: true }; }
      if (typeof p['scroll'] === 'string') {
        scrollPage(
          p['scroll'] as 'top' | 'bottom' | 'up' | 'down',
          typeof p['amount'] === 'number' ? p['amount'] : undefined
        );
        // Wait for scroll to settle, then return new visible content so the
        // LLM can continue without an extra "read" round-trip.
        await new Promise((r) => setTimeout(r, 450));
        return { success: true, data: readPage() };
      }
      if (typeof p['scrollTo'] === 'string') {
        return scrollToElement(p['scrollTo']);
      }
      return { success: false, error: 'navigate requires url, back, forward, scroll, or scrollTo param' };
    }

    case 'scrape': {
      if (p['links']) {
        const data = scrapeLinks(p['external'] !== false);
        return { success: true, data };
      }
      if (p['metadata']) {
        const data = scrapeMetadata();
        return { success: true, data };
      }
      if (p['table'] && typeof p['selector'] === 'string') {
        const data = scrapeTable(p['selector']);
        return { success: true, data };
      }
      if (typeof p['selector'] === 'string') {
        const limit = typeof p['limit'] === 'number' ? p['limit'] : 100;
        const data = scrapeElements(p['selector'], limit);
        return { success: true, data };
      }
      return { success: false, error: 'scrape requires selector, links, metadata, or table param' };
    }

    case 'press': {
      const key = p['key'] as string | undefined;
      if (!key) return { success: false, error: 'press requires a key param' };

      // Optionally focus a specific element first
      if (typeof p['selector'] === 'string') {
        const target = document.querySelector<HTMLElement>(p['selector']);
        target?.focus();
      }

      const focused = document.activeElement ?? document.body;
      const eventInit: KeyboardEventInit = {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
      };
      focused.dispatchEvent(new KeyboardEvent('keydown', eventInit));
      focused.dispatchEvent(new KeyboardEvent('keypress', eventInit));
      focused.dispatchEvent(new KeyboardEvent('keyup', eventInit));
      return { success: true };
    }

    case 'search':
    case 'screenshot':
      // Handled by the background script — should not reach the content script
      return { success: false, error: `${action.type} is handled by the background` };
  }
}
