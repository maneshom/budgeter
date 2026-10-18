import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import type { ExpenseCategory, NewExpensePayload } from '../../types/expense';
import { getTodayDateString } from '../../utils/date';
import { parseValidAmount } from '../../utils/currency';

interface AddExpenseModalProps {
  isOpen: boolean;
  categories: string[];
  onClose: () => void;
  onSubmit: (expense: NewExpensePayload) => Promise<void> | void;
}

interface FormErrors {
  name?: string;
  amount?: string;
  category?: string;
  date?: string;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  categories,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>(categories[0] || '');
  const [date, setDate] = useState(getTodayDateString());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus the first input on open
  useEffect(() => {
    if (isOpen) {
      // Small timeout ensures modal DOM element has mounted
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      // Reset form state on close
      setName('');
      setAmount('');
      setCategory(categories[0] || '');
      setDate(getTodayDateString());
      setNotes('');
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && categories.length > 0 && !categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [categories, category, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const validateField = (fieldName: string, value: string): string | undefined => {
    switch (fieldName) {
      case 'name': {
        const trimmed = value.trim();
        if (!trimmed) {
          return 'Expense name is required.';
        }
        if (trimmed.length < 2) {
          return 'Expense name must be at least 2 characters.';
        }
        if (trimmed.length > 100) {
          return 'Expense name cannot exceed 100 characters.';
        }
        return undefined;
      }
      case 'amount': {
        if (!value.trim()) {
          return 'Amount is required.';
        }
        const parsed = parseValidAmount(value);
        if (parsed === null) {
          return 'Please enter a valid positive amount greater than 0.';
        }
        if (parsed > 10000000) {
          return 'Amount exceeds maximum allowable limit (₹1,00,00,000).';
        }
        return undefined;
      }
      case 'category': {
        if (!categories.includes(value)) {
          return 'Please select a valid expense category.';
        }
        return undefined;
      }
      case 'date': {
        if (!value) {
          return 'Transaction date is required.';
        }
        return undefined;
      }
      default:
        return undefined;
    }
  };

  const validateAll = (): boolean => {
    const nextErrors: FormErrors = {};
    const nameErr = validateField('name', name);
    const amountErr = validateField('amount', amount);
    const catErr = validateField('category', category);
    const dateErr = validateField('date', date);

    if (nameErr) nextErrors.name = nameErr;
    if (amountErr) nextErrors.amount = amountErr;
    if (catErr) nextErrors.category = catErr;
    if (dateErr) nextErrors.date = dateErr;

    setErrors(nextErrors);
    setTouched({ name: true, amount: true, category: true, date: true });

    return Object.keys(nextErrors).length === 0;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    let val = '';
    if (field === 'name') val = name;
    else if (field === 'amount') val = amount;
    else if (field === 'category') val = category;
    else if (field === 'date') val = date;

    const error = validateField(field, val);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!validateAll()) {
      return;
    }

    const parsedAmount = parseValidAmount(amount);
    if (!parsedAmount) return;

    setIsSubmitting(true);

    try {
      await onSubmit({
        name: name.trim(),
        amount: parsedAmount,
        category,
        date,
        notes: notes.trim() || undefined,
      });

      // Reset and close
      setName('');
      setAmount('');
      setCategory('Food & Shopping');
      setDate(getTodayDateString());
      setNotes('');
      setErrors({});
      setTouched({});
      onClose();
    } catch (err) {
      console.error('Failed to submit expense', err);
      setErrors((prev) => ({
        ...prev,
        name: 'Failed to save expense. Please try again.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-expense-title"
      >
        <div className="modal-header">
          <div className="modal-header-text">
            <h2 id="add-expense-title" className="modal-title">
              Add New Expense
            </h2>
            <p className="modal-subtitle">
              Log household spending with category and amount
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-form">
            {/* Expense Name */}
            <div className="form-field">
              <label htmlFor="expense-name" className="form-label">
                <span>
                  Expense Name <span className="required-star">*</span>
                </span>
                <span style={{ fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
                  {name.length}/100
                </span>
              </label>
              <input
                ref={nameInputRef}
                id="expense-name"
                type="text"
                className={`form-input ${touched.name && errors.name ? 'is-invalid' : ''}`}
                placeholder="e.g. Grocery Shopping, Wifi Bill"
                value={name}
                maxLength={100}
                onChange={(e) => {
                  setName(e.target.value);
                  if (touched.name) {
                    setErrors((prev) => ({
                      ...prev,
                      name: validateField('name', e.target.value),
                    }));
                  }
                }}
                onBlur={() => handleBlur('name')}
                disabled={isSubmitting}
                required
              />
              {touched.name && errors.name && (
                <div className="field-error" role="alert">
                  <AlertCircle size={13} />
                  <span>{errors.name}</span>
                </div>
              )}
            </div>

            {/* Amount in INR */}
            <div className="form-field">
              <label htmlFor="expense-amount" className="form-label">
                <span>
                  Amount (INR) <span className="required-star">*</span>
                </span>
              </label>
              <div className="form-input-wrapper">
                <span className="currency-prefix">₹</span>
                <input
                  id="expense-amount"
                  type="number"
                  step="any"
                  min="0.01"
                  className={`form-input has-prefix ${
                    touched.amount && errors.amount ? 'is-invalid' : ''
                  }`}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (touched.amount) {
                      setErrors((prev) => ({
                        ...prev,
                        amount: validateField('amount', e.target.value),
                      }));
                    }
                  }}
                  onBlur={() => handleBlur('amount')}
                  disabled={isSubmitting}
                  required
                />
              </div>
              {touched.amount && errors.amount && (
                <div className="field-error" role="alert">
                  <AlertCircle size={13} />
                  <span>{errors.amount}</span>
                </div>
              )}
            </div>

            {/* Category */}
            <div className="form-field">
              <label htmlFor="expense-category" className="form-label">
                <span>
                  Category <span className="required-star">*</span>
                </span>
              </label>
              <select
                id="expense-category"
                className={`form-select ${
                  touched.category && errors.category ? 'is-invalid' : ''
                }`}
                value={category}
                onChange={(e) => {
                  const val = e.target.value as ExpenseCategory;
                  setCategory(val);
                  if (touched.category) {
                    setErrors((prev) => ({
                      ...prev,
                      category: validateField('category', val),
                    }));
                  }
                }}
                onBlur={() => handleBlur('category')}
                disabled={isSubmitting}
                required
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {touched.category && errors.category && (
                <div className="field-error" role="alert">
                  <AlertCircle size={13} />
                  <span>{errors.category}</span>
                </div>
              )}
            </div>

            {/* Date Field */}
            <div className="form-field">
              <label htmlFor="expense-date" className="form-label">
                <span>
                  Date <span className="required-star">*</span>
                </span>
              </label>
              <input
                id="expense-date"
                type="date"
                className={`form-input ${touched.date && errors.date ? 'is-invalid' : ''}`}
                value={date}
                max={getTodayDateString()}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (touched.date) {
                    setErrors((prev) => ({
                      ...prev,
                      date: validateField('date', e.target.value),
                    }));
                  }
                }}
                onBlur={() => handleBlur('date')}
                disabled={isSubmitting}
                required
              />
              {touched.date && errors.date && (
                <div className="field-error" role="alert">
                  <AlertCircle size={13} />
                  <span>{errors.date}</span>
                </div>
              )}
            </div>

            {/* Optional Notes */}
            <div className="form-field">
              <label htmlFor="expense-notes" className="form-label">
                <span>Optional Note / Description</span>
              </label>
              <input
                id="expense-notes"
                type="text"
                className="form-input"
                placeholder="e.g. Paid via UPI / Shared with Sarah"
                value={notes}
                maxLength={120}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving expense...</span>
                </>
              ) : (
                <span>Save expense</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
