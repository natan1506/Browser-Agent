export interface ScrapedElement {
  text: string;
  href?: string;
  src?: string;
  alt?: string;
  value?: string;
}

export interface ScrapeResult {
  selector: string;
  count: number;
  items: ScrapedElement[];
}

export interface LinkInfo {
  text: string;
  href: string;
}

export function scrapeElements(selector: string, limit = 100): ScrapeResult {
  const elements = Array.from(document.querySelectorAll(selector));
  const items: ScrapedElement[] = elements.slice(0, limit).map((el) => {
    const item: ScrapedElement = {
      text: (el as HTMLElement).innerText?.trim() ?? el.textContent?.trim() ?? '',
    };
    if ('href' in el && (el as HTMLAnchorElement).href) {
      item.href = (el as HTMLAnchorElement).href;
    }
    if ('src' in el && (el as HTMLImageElement).src) {
      item.src = (el as HTMLImageElement).src;
      item.alt = (el as HTMLImageElement).alt;
    }
    if ('value' in el) {
      item.value = (el as HTMLInputElement).value;
    }
    return item;
  });

  return { selector, count: elements.length, items };
}

export function scrapeTable(selector: string): { headers: string[]; rows: string[][] } {
  const table = document.querySelector<HTMLTableElement>(selector);
  if (!table) return { headers: [], rows: [] };

  const allRows = Array.from(table.querySelectorAll('tr'));
  if (allRows.length === 0) return { headers: [], rows: [] };

  const getCells = (row: Element): string[] =>
    Array.from(row.querySelectorAll('td, th')).map(
      (cell) => (cell as HTMLElement).innerText.trim()
    );

  const headerRow = table.querySelector('thead tr') ?? allRows[0];
  const headers = getCells(headerRow!);

  const bodyRows = Array.from(
    table.querySelectorAll('tbody tr')
  );
  const rows = (bodyRows.length > 0 ? bodyRows : allRows.slice(1)).map(getCells);

  return { headers, rows };
}

export function scrapeLinks(includeExternal = true): LinkInfo[] {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .filter((a) => {
      if (!a.href || !a.textContent?.trim()) return false;
      if (!includeExternal && !a.href.startsWith(window.location.origin)) return false;
      return true;
    })
    .slice(0, 80)
    .map((a) => ({
      text: a.innerText.trim() || a.title || a.href,
      href: a.href,
    }));
}

export function scrapeMetadata(): Record<string, string> {
  const meta: Record<string, string> = {
    title: document.title,
    url: window.location.href,
  };

  document.querySelectorAll<HTMLMetaElement>('meta[name], meta[property]').forEach((el) => {
    const key = el.name || el.getAttribute('property') || '';
    if (key && el.content) meta[key] = el.content;
  });

  return meta;
}
