// 月別売上の棒グラフ。echarts のうち、棒グラフに必要な部品だけを読み込む。
import { BarChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import { formatManYen, formatMonth } from '../lib/format.ts';
import type { MonthlySales } from '../lib/summary.ts';

echarts.use([BarChart, GridComponent, SVGRenderer]);

export function SalesChart({ data }: { data: MonthlySales[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: 'svg' });
    chart.setOption({
      animation: false,
      grid: { left: 16, right: 16, top: 36, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: data.map((d) => formatMonth(d.month)), axisTick: { show: false } },
      yAxis: { type: 'value', show: false },
      series: [
        {
          type: 'bar',
          data: data.map((d) => d.total),
          itemStyle: { color: '#2f6fb3' },
          label: { show: true, position: 'top', formatter: (p: { value: unknown }) => formatManYen(Number(p.value)) },
        },
      ],
    });
    return () => chart.dispose();
  }, [data]);

  return <div ref={ref} className="chart" data-testid="sales-chart" role="img" aria-label="月別売上" />;
}
