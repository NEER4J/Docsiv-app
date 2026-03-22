/**
 * Imperative Konva chart drawing for PDF/export/preview (matches react-konva chart visuals).
 */

import { getChartDataPointsFromAttrs } from '@/lib/konva-chart-sheet';

type KonvaRoot = typeof import('konva').default;

export function addKonvaChartToLayer(
  Konva: KonvaRoot,
  layer: InstanceType<KonvaRoot['Layer']>,
  attrs: Record<string, unknown>
): void {
  const x = (attrs.x as number) ?? 0;
  const y = (attrs.y as number) ?? 0;
  const width = (attrs.width as number) ?? 300;
  const height = (attrs.height as number) ?? 200;
  const chartType = ((attrs.chartType as string) ?? 'bar') as 'bar' | 'line' | 'pie' | 'area';
  const data = getChartDataPointsFromAttrs(attrs);
  const colors = (attrs.colors as string[]) ?? ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const showLabels = (attrs.showLabels as boolean) ?? true;
  const showLegend = (attrs.showLegend as boolean) ?? true;

  const group = new Konva.Group({ x, y, listening: false });
  const padding = 32;
  const chartWidth = Math.max(0, width - padding * 2);
  const chartHeight = Math.max(0, height - padding * 2);

  if (data.length === 0 || chartWidth <= 0 || chartHeight <= 0) {
    group.add(
      new Konva.Rect({ x: 0, y: 0, width, height, fill: '#f8fafc', stroke: '#e5e7eb', strokeWidth: 1, listening: false })
    );
    group.add(
      new Konva.Text({
        x: 0,
        y: height / 2 - 10,
        width,
        text: 'No data',
        fontSize: 14,
        fill: '#9ca3af',
        align: 'center',
        listening: false,
      })
    );
    layer.add(group);
    return;
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  if (chartType === 'bar') {
    const barWidth = data.length > 0 ? (chartWidth / data.length) * 0.6 : 0;
    const spacing = data.length > 0 ? (chartWidth / data.length) * 0.4 : 0;
    group.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: '#f8fafc', stroke: '#e5e7eb', strokeWidth: 1, listening: false }));
    group.add(new Konva.Rect({ x: padding, y: padding, width: chartWidth, height: chartHeight, fill: 'white', listening: false }));
    for (let i = 0; i < 5; i++) {
      const ratio = [0, 0.25, 0.5, 0.75, 1][i]!;
      group.add(
        new Konva.Line({
          points: [padding, padding + chartHeight * (1 - ratio), padding + chartWidth, padding + chartHeight * (1 - ratio)],
          stroke: '#e5e7eb',
          strokeWidth: 1,
          listening: false,
        })
      );
    }
    data.forEach((item, i) => {
      const barHeight = (item.value / maxValue) * chartHeight;
      const barX = padding + i * (barWidth + spacing) + spacing / 2;
      const barY = padding + chartHeight - barHeight;
      const barColor = item.color || colors[i % colors.length];
      group.add(
        new Konva.Rect({
          x: barX,
          y: barY,
          width: Math.max(2, barWidth),
          height: Math.max(2, barHeight),
          fill: barColor,
          cornerRadius: 2,
          listening: false,
        })
      );
      if (showLabels && barHeight > 20) {
        group.add(
          new Konva.Text({
            x: barX,
            y: barY - 16,
            width: Math.max(2, barWidth),
            text: String(item.value),
            fontSize: 10,
            fill: '#374151',
            align: 'center',
            listening: false,
          })
        );
      }
    });
    if (showLabels) {
      data.forEach((item, i) => {
        const labelX = padding + i * (barWidth + spacing) + spacing / 2;
        group.add(
          new Konva.Text({
            x: labelX,
            y: padding + chartHeight + 8,
            width: Math.max(2, barWidth),
            text: item.label,
            fontSize: 9,
            fill: '#6b7280',
            align: 'center',
            listening: false,
          })
        );
      });
    }
    layer.add(group);
    return;
  }

  if (chartType === 'line' || chartType === 'area') {
    const xStep = data.length > 1 ? chartWidth / (data.length - 1) : 0;
    const points: number[] = [];
    data.forEach((item, i) => {
      const px = padding + i * xStep;
      const py = padding + chartHeight - (item.value / maxValue) * chartHeight;
      points.push(px, py);
    });

    group.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: '#f8fafc', stroke: '#e5e7eb', strokeWidth: 1, listening: false }));
    for (let i = 0; i < 5; i++) {
      const ratio = [0, 0.25, 0.5, 0.75, 1][i]!;
      group.add(
        new Konva.Line({
          points: [padding, padding + chartHeight * (1 - ratio), padding + chartWidth, padding + chartHeight * (1 - ratio)],
          stroke: '#e5e7eb',
          strokeWidth: 1,
          listening: false,
        })
      );
    }
    if (chartType === 'area') {
      group.add(
        new Konva.Rect({
          x: padding,
          y: padding,
          width: chartWidth,
          height: chartHeight,
          fillLinearGradientStartPoint: { x: 0, y: 0 },
          fillLinearGradientEndPoint: { x: 0, y: chartHeight },
          fillLinearGradientColorStops: [0, `${colors[0]}40`, 1, `${colors[0]}10`],
          listening: false,
        })
      );
    }
    if (points.length >= 4) {
      group.add(
        new Konva.Line({
          points,
          stroke: colors[0],
          strokeWidth: 3,
          lineCap: 'round',
          lineJoin: 'round',
          listening: false,
        })
      );
    }
    data.forEach((item, i) => {
      const px = padding + i * xStep;
      const py = padding + chartHeight - (item.value / maxValue) * chartHeight;
      const pointColor = item.color || colors[i % colors.length];
      group.add(
        new Konva.Circle({
          x: px,
          y: py,
          radius: 5,
          fill: 'white',
          stroke: pointColor,
          strokeWidth: 2,
          listening: false,
        })
      );
      if (showLabels) {
        group.add(
          new Konva.Text({
            x: px - 15,
            y: py - 18,
            width: 30,
            text: String(item.value),
            fontSize: 9,
            fill: '#374151',
            align: 'center',
            listening: false,
          })
        );
      }
    });
    if (showLabels) {
      data.forEach((item, i) => {
        const labelX = padding + i * xStep - 20;
        group.add(
          new Konva.Text({
            x: labelX,
            y: padding + chartHeight + 8,
            width: 40,
            text: item.label,
            fontSize: 9,
            fill: '#6b7280',
            align: 'center',
            listening: false,
          })
        );
      });
    }
    layer.add(group);
    return;
  }

  if (chartType === 'pie') {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(chartWidth, chartHeight) / 2 - 10;
    let currentAngle = -Math.PI / 2;

    group.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: '#f8fafc', stroke: '#e5e7eb', strokeWidth: 1, listening: false }));

    data.forEach((item, i) => {
      const sliceAngle = total > 0 ? (item.value / total) * Math.PI * 2 : 0;
      const startAngle = currentAngle;
      const sliceColor = item.color || colors[i % colors.length];
      const numSegments = Math.max(3, Math.floor(sliceAngle * 10));
      const wedgePoints: number[] = [centerX, centerY];
      for (let j = 0; j <= numSegments; j++) {
        const angle = startAngle + (sliceAngle * j) / numSegments;
        wedgePoints.push(centerX + radius * Math.cos(angle));
        wedgePoints.push(centerY + radius * Math.sin(angle));
      }
      currentAngle += sliceAngle;
      group.add(
        new Konva.Line({
          points: wedgePoints,
          closed: true,
          fill: sliceColor,
          stroke: 'white',
          strokeWidth: 2,
          listening: false,
        })
      );
      if (showLabels && sliceAngle > 0.3) {
        group.add(
          new Konva.Text({
            x: centerX + radius * 0.6 * Math.cos(startAngle + sliceAngle / 2) - 15,
            y: centerY + radius * 0.6 * Math.sin(startAngle + sliceAngle / 2) - 6,
            width: 30,
            text: `${Math.round((item.value / total) * 100)}%`,
            fontSize: 10,
            fill: 'white',
            fontStyle: 'bold',
            align: 'center',
            listening: false,
          })
        );
      }
    });

    if (showLegend) {
      data.forEach((item, i) => {
        const legendY = padding + i * 16;
        const legendColor = item.color || colors[i % colors.length];
        group.add(new Konva.Rect({ x: padding, y: legendY, width: 10, height: 10, fill: legendColor, cornerRadius: 2, listening: false }));
        group.add(
          new Konva.Text({
            x: padding + 14,
            y: legendY + 1,
            text: `${item.label}: ${item.value}`,
            fontSize: 9,
            fill: '#374151',
            listening: false,
          })
        );
      });
    }
    layer.add(group);
    return;
  }

  layer.add(group);
}
