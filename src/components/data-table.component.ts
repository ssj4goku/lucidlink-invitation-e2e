import type { Locator, Page } from '@playwright/test';

export class DataTable {
  readonly root: Locator;
  private readonly rowElements: Locator;
  readonly rows: Locator;

  constructor(
    private readonly page: Page,
    private readonly name: string,
  ) {
    this.root = page.getByTestId(`table-${name}`);
    this.rowElements = page.locator(`[data-testid^="table-row-"][data-testid$="-${name}"]`);
    this.rows = this.rowElements.filter({
      hasNot: page.getByTestId(`table-row-head-${name}`),
    });
  }

  row(key: string): Locator {
    return this.page.getByTestId(`table-row-${key}-${this.name}`);
  }

  cell(key: string, column: string): Locator {
    return this.page.getByTestId(`table-cell-${key}-${column}-${this.name}`);
  }

  async keys(): Promise<string[]> {
    const ids = await this.rowElements.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-testid') ?? ''),
    );

    const prefix = 'table-row-';
    const suffix = `-${this.name}`;
    return ids
      .map((id) => id.slice(prefix.length, id.length - suffix.length))
      .filter((key) => key && key !== 'head');
  }
}
