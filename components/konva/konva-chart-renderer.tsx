'use client';

import React from 'react';
import { Group, Rect, Text, Line, Circle } from 'react-konva';

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface KonvaChartRendererProps {
  x: number;
  y: number;
  width: number;
  height: number;
  chartType: 'bar' | 'line' | 'pie' | 'area';
  data: ChartDataPoint[];
  colors: string[];
  showLegend: boolean;
  showLabels: boolean;
}

export function KonvaChartRenderer({
  x,
  y,
  width,
  height,
  chartType,
  data,
  colors,
  showLegend,
  showLabels,
}: KonvaChartRendererProps) {
  const padding = 32;
  const chartWidth = Math.max(0, width - padding * 2);
  const chartHeight = Math.max(0, height - padding * 2);

  if (data.length === 0 || chartWidth <= 0 || chartHeight <= 0) {
    return (
      <Group x={x} y={y} listening={false}>
        <Rect width={width} height={height} fill="#f8fafc" stroke="#e5e7eb" strokeWidth={1} listening={false} />
        <Text
          x={0}
          y={height / 2 - 10}
          width={width}
          text="No data"
          fontSize={14}
          fill="#9ca3af"
          align="center"
          listening={false}
        />
      </Group>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  if (chartType === 'bar') {
    const barWidth = data.length > 0 ? (chartWidth / data.length) * 0.6 : 0;
    const spacing = data.length > 0 ? (chartWidth / data.length) * 0.4 : 0;

    return (
      <Group x={x} y={y} listening={false}>
        {/* Background */}
        <Rect width={width} height={height} fill="#f8fafc" stroke="#e5e7eb" strokeWidth={1} listening={false} />

        {/* Chart area background */}
        <Rect x={padding} y={padding} width={chartWidth} height={chartHeight} fill="white" listening={false} />

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <Line
            key={`grid-${i}`}
            points={[
              padding,
              padding + chartHeight * (1 - ratio),
              padding + chartWidth,
              padding + chartHeight * (1 - ratio),
            ]}
            stroke="#e5e7eb"
            strokeWidth={1}
            listening={false}
          />
        ))}

        {/* Bars */}
        {data.map((item, i) => {
          const barHeight = (item.value / maxValue) * chartHeight;
          const barX = padding + i * (barWidth + spacing) + spacing / 2;
          const barY = padding + chartHeight - barHeight;
          const barColor = item.color || colors[i % colors.length];

          return (
            <React.Fragment key={i}>
              <Rect
                x={barX}
                y={barY}
                width={Math.max(2, barWidth)}
                height={Math.max(2, barHeight)}
                fill={barColor}
                cornerRadius={2}
                listening={false}
              />
              {showLabels && barHeight > 20 && (
                <Text
                  x={barX}
                  y={barY - 16}
                  width={Math.max(2, barWidth)}
                  text={String(item.value)}
                  fontSize={10}
                  fill="#374151"
                  align="center"
                  listening={false}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* X-axis labels */}
        {showLabels &&
          data.map((item, i) => {
            const labelX = padding + i * (barWidth + spacing) + spacing / 2;
            return (
              <Text
                key={`label-${i}`}
                x={labelX}
                y={padding + chartHeight + 8}
                width={Math.max(2, barWidth)}
                text={item.label}
                fontSize={9}
                fill="#6b7280"
                align="center"
                listening={false}
              />
            );
          })}
      </Group>
    );
  }

  if (chartType === 'line' || chartType === 'area') {
    const xStep = data.length > 1 ? chartWidth / (data.length - 1) : 0;
    const points: number[] = [];
    const areaPoints: number[] = [];

    data.forEach((item, i) => {
      const px = padding + i * xStep;
      const py = padding + chartHeight - (item.value / maxValue) * chartHeight;
      points.push(px, py);
      areaPoints.push(px, py);
    });

    // Close the area for area chart
    if (chartType === 'area' && data.length > 0) {
      areaPoints.push(padding + (data.length - 1) * xStep, padding + chartHeight);
      areaPoints.push(padding, padding + chartHeight);
    }

    return (
      <Group x={x} y={y} listening={false}>
        {/* Background */}
        <Rect width={width} height={height} fill="#f8fafc" stroke="#e5e7eb" strokeWidth={1} listening={false} />

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <Line
            key={`grid-${i}`}
            points={[
              padding,
              padding + chartHeight * (1 - ratio),
              padding + chartWidth,
              padding + chartHeight * (1 - ratio),
            ]}
            stroke="#e5e7eb"
            strokeWidth={1}
            listening={false}
          />
        ))}

        {/* Area fill */}
        {chartType === 'area' && areaPoints.length >= 6 && (
          <Rect
            x={padding}
            y={padding}
            width={chartWidth}
            height={chartHeight}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: 0, y: chartHeight }}
            fillLinearGradientColorStops={[0, colors[0] + '40', 1, colors[0] + '10']}
            listening={false}
          />
        )}

        {/* Line */}
        {points.length >= 4 && (
          <Line
            points={points}
            stroke={colors[0]}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )}

        {/* Data points */}
        {data.map((item, i) => {
          const px = padding + i * xStep;
          const py = padding + chartHeight - (item.value / maxValue) * chartHeight;
          const pointColor = item.color || colors[i % colors.length];

          return (
            <React.Fragment key={i}>
              <Circle
                x={px}
                y={py}
                radius={5}
                fill="white"
                stroke={pointColor}
                strokeWidth={2}
                listening={false}
              />
              {showLabels && (
                <Text
                  x={px - 15}
                  y={py - 18}
                  width={30}
                  text={String(item.value)}
                  fontSize={9}
                  fill="#374151"
                  align="center"
                  listening={false}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* X-axis labels */}
        {showLabels &&
          data.map((item, i) => {
            const labelX = padding + i * xStep - 20;
            return (
              <Text
                key={`label-${i}`}
                x={labelX}
                y={padding + chartHeight + 8}
                width={40}
                text={item.label}
                fontSize={9}
                fill="#6b7280"
                align="center"
                listening={false}
              />
            );
          })}
      </Group>
    );
  }

  if (chartType === 'pie') {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(chartWidth, chartHeight) / 2 - 10;

    let currentAngle = -Math.PI / 2; // Start at top

    return (
      <Group x={x} y={y} listening={false}>
        {/* Background */}
        <Rect width={width} height={height} fill="#f8fafc" stroke="#e5e7eb" strokeWidth={1} listening={false} />

        {/* Pie slices */}
        {data.map((item, i) => {
          const sliceAngle = total > 0 ? (item.value / total) * Math.PI * 2 : 0;
          const startAngle = currentAngle;
          const sliceColor = item.color || colors[i % colors.length];

          // Create wedge shape using points for triangle fan
          const numSegments = Math.max(3, Math.floor(sliceAngle * 10));
          const wedgePoints: number[] = [centerX, centerY];
          for (let j = 0; j <= numSegments; j++) {
            const angle = startAngle + (sliceAngle * j) / numSegments;
            wedgePoints.push(centerX + radius * Math.cos(angle));
            wedgePoints.push(centerY + radius * Math.sin(angle));
          }

          currentAngle += sliceAngle;

          return (
            <React.Fragment key={i}>
              {/* Approximate pie slice with polygon */}
              <Line
                points={wedgePoints}
                closed
                fill={sliceColor}
                stroke="white"
                strokeWidth={2}
                listening={false}
              />

              {/* Label line and text for larger slices */}
              {showLabels && sliceAngle > 0.3 && (
                <>
                  {/* Label position at middle of slice */}
                  <Text
                    x={centerX + radius * 0.6 * Math.cos(startAngle + sliceAngle / 2) - 15}
                    y={centerY + radius * 0.6 * Math.sin(startAngle + sliceAngle / 2) - 6}
                    width={30}
                    text={`${Math.round((item.value / total) * 100)}%`}
                    fontSize={10}
                    fill="white"
                    fontStyle="bold"
                    align="center"
                    listening={false}
                  />
                </>
              )}
            </React.Fragment>
          );
        })}

        {/* Legend */}
        {showLegend && (
          <Group listening={false}>
            {data.map((item, i) => {
              const legendY = padding + i * 16;
              const legendColor = item.color || colors[i % colors.length];
              return (
                <React.Fragment key={`legend-${i}`}>
                  <Rect
                    x={padding}
                    y={legendY}
                    width={10}
                    height={10}
                    fill={legendColor}
                    cornerRadius={2}
                    listening={false}
                  />
                  <Text
                    x={padding + 14}
                    y={legendY + 1}
                    text={`${item.label}: ${item.value}`}
                    fontSize={9}
                    fill="#374151"
                    listening={false}
                  />
                </React.Fragment>
              );
            })}
          </Group>
        )}
      </Group>
    );
  }

  return null;
}
