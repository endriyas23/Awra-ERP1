
import React from 'react';

export const COLORS = {
  primary: '#0f766e',
  secondary: '#0d9488',
  danger: '#e11d48',
  warning: '#f59e0b',
  info: '#3b82f6',
  success: '#10b981'
};

export const FEED_SCHEDULE_DATA = {
  LAYER: [
    { 
      phase: 'Starter Phase', 
      feedSearchTerm: 'Chick Starter', // Matches "Chick Starter Feed"
      rangeLabel: '1–28 Days',
      color: 'text-amber-500',
      bg: 'bg-amber-50',
      subStages: [
        { min: 0, max: 7, rate: '10–12 g', label: '0–7 days' },
        { min: 8, max: 14, rate: '16–18 g', label: '8–14 days' },
        { min: 15, max: 21, rate: '24–26 g', label: '15–21 days' },
        { min: 22, max: 28, rate: '31–33 g', label: '22–28 days' }
      ]
    },
    { 
      phase: 'Rearing Phase', 
      feedSearchTerm: 'Rearing', // Matches "Rearing Feed"
      rangeLabel: '29–56 Days',
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      subStages: [
        { min: 29, max: 35, rate: '36–38 g', label: '29–35 days' },
        { min: 36, max: 42, rate: '41–43 g', label: '36–42 days' },
        { min: 43, max: 49, rate: '45–47 g', label: '43–49 days' },
        { min: 50, max: 56, rate: '48–50 g', label: '50–56 days' }
      ]
    },
    { 
      phase: 'Pullet Phase', 
      feedSearchTerm: 'Pullet', // Matches "Pullet Grower Feed"
      rangeLabel: '9 Weeks – 5% Prod',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      subStages: [
        { min: 57, max: 70, rate: '52–55 g', label: '9–10 weeks' },
        { min: 71, max: 84, rate: '58–60 g', label: '11–12 weeks' },
        { min: 85, max: 98, rate: '62–65 g', label: '13–14 weeks' },
        { min: 99, max: 112, rate: '68–70 g', label: '15–16 weeks' },
        { min: 113, max: 126, rate: '72–75 g', label: '17–18 weeks' },
        { min: 127, max: 140, rate: '80–85 g', label: '19–20 weeks' }
      ]
    },
    { 
      phase: 'Layer Phase', 
      feedSearchTerm: 'Layer Phase 1', // Matches "Layer Phase 1 Feed"
      rangeLabel: 'Production (5%+)',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      subStages: [
        { min: 141, max: 210, rate: '105–115 g', label: '21–30 weeks (Peak)' },
        { min: 211, max: 350, rate: '115–120 g', label: '31–50 weeks' },
        { min: 351, max: 455, rate: '120–125 g', label: '51–65 weeks' },
        { min: 456, max: 9999, rate: '125–130 g', label: '66+ weeks' }
      ]
    }
  ],
  BROILER: [
    { 
      phase: 'Starter Phase', 
      feedSearchTerm: 'Starter Feed', // Matches "Starter Feed"
      rangeLabel: '1–10 Days', 
      color: 'text-amber-500',
      bg: 'bg-amber-50',
      subStages: [
        { min: 0, max: 10, rate: '15–25 g', label: '1–10 days' }
      ]
    },
    { 
      phase: 'Grower Phase', 
      feedSearchTerm: 'Grower Feed', // Matches "Grower Feed"
      rangeLabel: '11–30 Days', 
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      subStages: [
        { min: 11, max: 30, rate: '60–90 g', label: '11–30 days' }
      ]
    },
    { 
      phase: 'Finisher Phase', 
      feedSearchTerm: 'Finisher Feed', // Matches "Finisher Feed"
      rangeLabel: '31–45 Days', 
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      subStages: [
        { min: 31, max: 100, rate: '110–150 g', label: '31–45 days' }
      ]
    }
  ]
};

export const PERFORMANCE_DATA = [
  { date: 'Mon', mortalityRate: 0, fcr: 0, production: 0, weight: 0 },
  { date: 'Tue', mortalityRate: 0, fcr: 0, production: 0, weight: 0 },
  { date: 'Wed', mortalityRate: 0, fcr: 0, production: 0, weight: 0 },
  { date: 'Thu', mortalityRate: 0, fcr: 0, production: 0, weight: 0 },
  { date: 'Fri', mortalityRate: 0, fcr: 0, production: 0, weight: 0 },
  { date: 'Sat', mortalityRate: 0, fcr: 0, production: 0, weight: 0 },
  { date: 'Sun', mortalityRate: 0, fcr: 0, production: 0, weight: 0 },
];
