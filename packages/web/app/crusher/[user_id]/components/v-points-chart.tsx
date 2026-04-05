'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';
import { themeTokens } from '@/app/theme/theme-config';
import type { VPointsDataPoint } from '../utils/chart-data-builders';

interface VPointsChartProps {
  data: VPointsDataPoint[];
}

export default function VPointsChart({ data }: VPointsChartProps) {
  const totalPoints = data[data.length - 1]?.cumulativePoints ?? 0;

  // Downsample labels for readability — show at most ~12 labels
  const labelInterval = Math.max(1, Math.floor(data.length / 12));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
        <Typography variant="body2" component="span" fontWeight={600} sx={{ fontSize: 13, color: 'var(--neutral-600)' }}>
          V-Points
        </Typography>
        <Typography variant="body2" component="span" color="text.secondary" sx={{ fontSize: 12 }}>
          {totalPoints.toLocaleString()} total
        </Typography>
      </Box>
      <LineChart
        series={[{
          data: data.map((d) => d.cumulativePoints),
          label: 'V-Points',
          color: themeTokens.colors.primary,
          area: true,
          curve: 'linear' as const,
          showMark: data.length <= 26,
        }]}
        xAxis={[{
          data: data.map((d) => d.weekLabel),
          scaleType: 'band' as const,
          tickLabelStyle: { fontSize: 10 },
          tickInterval: (_value: string, index: number) => index % labelInterval === 0,
        }]}
        yAxis={[{
          label: 'V-Points',
          tickLabelStyle: { fontSize: 10 },
        }]}
        height={200}
        margin={{ top: 10, bottom: 30, left: 50, right: 10 }}
        hideLegend
      />
    </Box>
  );
}
