export interface ColorOption {
  name: string;
  bg: string;
  border: string;
  text: string;
  isDark?: boolean;
}

export interface CommentItem {
  id: string;
  username: string;
  content: string;
  createdAt: string;
}

export interface Note {
  id: string;
  username: string;
  title?: string;
  content?: string;
  imageUrl?: string;
  color: ColorOption;
  likes: number;
  comments: CommentItem[];
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  zIndex: number;
  createdAt: string;
}

export interface BoardState {
  code: string;
  title: string;
  description: string;
  wallpaper: string; // theme id
  editKey: string;
  createdAt: string;
  notes: Record<string, Note>;
}

export interface ThemeOption {
  id: string;
  name: string;
  description: string;
  bgClass: string;
  textTheme: 'light' | 'dark';
}

export type LayoutMode = 'grid' | 'canvas';
