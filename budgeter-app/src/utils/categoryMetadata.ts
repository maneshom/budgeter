import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import {
  ShoppingBag,
  Home,
  Zap,
  Car,
  Utensils,
  HeartPulse,
  GraduationCap,
  Film,
  Tag,
} from 'lucide-react';
import type { ExpenseCategory } from '../types/expense';

export interface CategoryInfo {
  label: ExpenseCategory;
  icon: ComponentType<LucideProps>;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export const CATEGORY_CONFIG: Record<ExpenseCategory, CategoryInfo> = {
  'Food & Shopping': {
    label: 'Food & Shopping',
    icon: ShoppingBag,
    bgColor: '#EFF6FF',
    textColor: '#1D4ED8',
    borderColor: '#BFDBFE',
  },
  Housing: {
    label: 'Housing',
    icon: Home,
    bgColor: '#F5F3FF',
    textColor: '#6D28D9',
    borderColor: '#DDD6FE',
  },
  Utilities: {
    label: 'Utilities',
    icon: Zap,
    bgColor: '#FFFBEB',
    textColor: '#B45309',
    borderColor: '#FDE68A',
  },
  Transport: {
    label: 'Transport',
    icon: Car,
    bgColor: '#F0FDFA',
    textColor: '#0F766E',
    borderColor: '#99F6E4',
  },
  'Food & Dining': {
    label: 'Food & Dining',
    icon: Utensils,
    bgColor: '#FFF7ED',
    textColor: '#C2410C',
    borderColor: '#FED7AA',
  },
  Healthcare: {
    label: 'Healthcare',
    icon: HeartPulse,
    bgColor: '#FEF2F2',
    textColor: '#B91C1C',
    borderColor: '#FECACA',
  },
  Education: {
    label: 'Education',
    icon: GraduationCap,
    bgColor: '#FDF4FF',
    textColor: '#A21CAF',
    borderColor: '#F5D0FE',
  },
  Entertainment: {
    label: 'Entertainment',
    icon: Film,
    bgColor: '#ECFEFF',
    textColor: '#0E7490',
    borderColor: '#A5F3FC',
  },
  Other: {
    label: 'Other',
    icon: Tag,
    bgColor: '#F3F4F6',
    textColor: '#374151',
    borderColor: '#E5E7EB',
  },
};

export function getCategoryInfo(category: ExpenseCategory): CategoryInfo {
  return (
    CATEGORY_CONFIG[category] ?? {
      label: category,
      icon: Tag,
      bgColor: '#F3F4F6',
      textColor: '#374151',
      borderColor: '#E5E7EB',
    }
  );
}

