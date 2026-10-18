import React, { useState } from 'react';
import { X, Loader2, Building, AlertCircle } from 'lucide-react';
import { workspaceService } from '../../services/workspaceService';
import type { Workspace } from '../../types/expense';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (workspace: Workspace) => void;
  userId?: string;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  userId,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Workspace name is required.');
      return;
    }

    setIsLoading(true);

    try {
      const created = await workspaceService.createWorkspace(
        cleanName,
        description.trim() || undefined,
        currency,
        userId
      );
      setName('');
      setDescription('');
      setCurrency('INR');
      onCreated(created);
      onClose();
    } catch (err: any) {
      console.error('Failed to create workspace:', err);
      setError(err.message || 'Failed to create workspace. Only owners are authorized.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-workspace-title"
      >
        <div className="modal-header">
          <div className="modal-header-text">
            <h2 id="create-workspace-title" className="modal-title">
              Create New Workspace
            </h2>
            <p className="modal-subtitle">
              Set up a separate household budget and expense workspace
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close modal dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-form">
            {error && (
              <div className="auth-error" role="alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-field">
              <label htmlFor="ws-name" className="form-label">
                Workspace Name <span className="required-star">*</span>
              </label>
              <div className="form-input-wrapper">
                <Building size={16} className="input-icon" />
                <input
                  id="ws-name"
                  type="text"
                  className="form-input has-prefix-icon"
                  placeholder="e.g. Mumbai Household, Vacation Budget"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="ws-description" className="form-label">
                Description (Optional)
              </label>
              <input
                id="ws-description"
                type="text"
                className="form-input"
                placeholder="e.g. Shared expenses for parents & siblings"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={100}
                disabled={isLoading}
              />
            </div>

            <div className="form-field">
              <label htmlFor="ws-currency" className="form-label">
                Currency
              </label>
              <select
                id="ws-currency"
                className="form-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={isLoading}
              >
                <option value="INR">Indian Rupee (INR - ₹)</option>
                <option value="USD">US Dollar (USD - $)</option>
                <option value="EUR">Euro (EUR - €)</option>
                <option value="GBP">British Pound (GBP - £)</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Creating workspace...</span>
                </>
              ) : (
                <span>Create Workspace</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

