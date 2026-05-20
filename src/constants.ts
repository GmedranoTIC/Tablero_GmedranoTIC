import { ColorOption, ThemeOption } from './types';

export const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const THEM_OPTIONS: ThemeOption[] = [
  {
    id: 'editorial',
    name: 'Editorial 🪶',
    description: 'Estilo periódico sobre papel crema tradicional',
    bgClass: 'bg-[#faf7f2] bg-[radial-gradient(rgba(26,21,18,0.06)_1px,transparent_1px)] [background-size:22px_22px]',
    textTheme: 'dark'
  },
  {
    id: 'minimalist',
    name: 'Técnico 📐',
    description: 'Cuadrícula técnica limpia para lluvia de ideas',
    bgClass: 'bg-[#f2ede4] bg-[linear-gradient(rgba(26,21,18,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(26,21,18,0.04)_1px,transparent_1px)] [background-size:24px_24px]',
    textTheme: 'dark'
  },
  {
    id: 'sunset',
    name: 'Atardecer 🌅',
    description: 'Gradiente cálido enérgico e inspirador',
    bgClass: 'bg-gradient-to-tr from-[#f59e0b] via-[#ea580c] to-[#4f46e5]',
    textTheme: 'light'
  },
  {
    id: 'sage',
    name: 'Olivo 🌿',
    description: 'Verde orgánico y relajante',
    bgClass: 'bg-gradient-to-br from-[#d1fae5] via-[#a7f3d0] to-[#6ee7b7]',
    textTheme: 'dark'
  },
  {
    id: 'cyber',
    name: 'Cyber 🌌',
    description: 'Espacio tecnológico futurista con cuadrícula azul',
    bgClass: 'bg-[#0a0b0f] bg-[radial-gradient(rgba(30,50,110,0.4)_1px,transparent_1px)] [background-size:24px_24px]',
    textTheme: 'light'
  }
];

export const NOTE_COLORS: ColorOption[] = [
  {
    name: 'Blanco',
    bg: '#ffffff',
    border: 'rgba(26,21,18,0.12)',
    text: '#1a1512',
    isDark: false
  },
  {
    name: 'Naranja',
    bg: '#f97316',
    border: '#ea580c',
    text: '#ffffff',
    isDark: true
  },
  {
    name: 'Crema',
    bg: '#fffbeb',
    border: 'rgba(217,119,6,0.2)',
    text: '#78350f',
    isDark: false
  },
  {
    name: 'Azul',
    bg: '#f0f9ff',
    border: 'rgba(14,165,233,0.2)',
    text: '#0369a1',
    isDark: false
  },
  {
    name: 'Verde',
    bg: '#f0fdf4',
    border: 'rgba(34,197,94,0.2)',
    text: '#15803d',
    isDark: false
  },
  {
    name: 'Dorado',
    bg: '#eab308',
    border: '#ca8a04',
    text: '#ffffff',
    isDark: true
  },
  {
    name: 'Oscuro',
    bg: '#1a1512',
    border: 'rgba(255,255,255,0.1)',
    text: '#f2ede4',
    isDark: true
  },
  {
    name: 'Lila',
    bg: '#faf5ff',
    border: 'rgba(168,85,247,0.2)',
    text: '#7e22ce',
    isDark: false
  }
];
