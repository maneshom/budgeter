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

export const CATEGORY_CONFIG: Partial<Record<ExpenseCategory, CategoryInfo>> = {
  'Food & Shopping': {
    label: 'Food & Shopping',
    icon: ShoppingBag,
    bgColor: '#EFF6FF',
    textColor: '#1E40AF',
    borderColor: '#93C5FD',
  },
  Housing: {
    label: 'Housing',
    icon: Home,
    bgColor: '#F5F3FF',
    textColor: '#5B21B6',
    borderColor: '#C4B5FD',
  },
  Utilities: {
    label: 'Utilities',
    icon: Zap,
    bgColor: '#FFFBEB',
    textColor: '#92400E',
    borderColor: '#FCD34D',
  },
  Transport: {
    label: 'Transport',
    icon: Car,
    bgColor: '#F0FDFA',
    textColor: '#115E59',
    borderColor: '#5EEAD4',
  },
  'Food & Dining': {
    label: 'Food & Dining',
    icon: Utensils,
    bgColor: '#FFF7ED',
    textColor: '#9A3412',
    borderColor: '#FDBA74',
  },
  Healthcare: {
    label: 'Healthcare',
    icon: HeartPulse,
    bgColor: '#FEF2F2',
    textColor: '#991B1B',
    borderColor: '#FCA5A5',
  },
  Education: {
    label: 'Education',
    icon: GraduationCap,
    bgColor: '#FDF4FF',
    textColor: '#86198F',
    borderColor: '#F0ABFC',
  },
  Entertainment: {
    label: 'Entertainment',
    icon: Film,
    bgColor: '#ECFEFF',
    textColor: '#155E75',
    borderColor: '#67E8F9',
  },
  Other: {
    label: 'Other',
    icon: Tag,
    bgColor: '#F1F5F9',
    textColor: '#1E293B',
    borderColor: '#94A3B8',
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
