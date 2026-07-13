export const PHP_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 1] as const;

export interface DenominationLine {
  denomination: number;
  count: number;
  total: number;
}

export const emptyDenominationRow = (): DenominationLine => ({
  denomination: 1000,
  count: 0,
  total: 0,
});

export const formatDenomination = (value: number) =>
  `P${Number(value).toLocaleString('en-PH')}`;

export const recalcLine = (line: Pick<DenominationLine, 'denomination' | 'count'>): DenominationLine => {
  const denomination = Number(line.denomination) || 0;
  const count = Math.max(0, Math.floor(Number(line.count) || 0));
  return {
    denomination,
    count,
    total: denomination * count,
  };
};

export const sumDenominationLines = (lines: DenominationLine[]) =>
  lines.reduce((sum, line) => sum + (Number(line.total) || 0), 0);

export const toPayloadBreakdown = (lines: DenominationLine[]) =>
  lines
    .map((line) => recalcLine(line))
    .filter((line) => line.count > 0 && line.denomination > 0)
    .map((line) => ({
      denomination: line.denomination,
      count: line.count,
      total: line.total,
    }));
