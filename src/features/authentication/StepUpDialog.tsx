import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../ApplicationApiClient';
import { useAuthentication } from '../../AuthenticationContext';

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.fieldErrors.length > 0) {
      return error.fieldErrors[0].message;
    }
    if (error.code === 'RATE_LIMITED' && error.retryAfterSeconds) {
      return `Too many attempts. Try again in ${error.retryAfterSeconds} seconds.`;
    }
    return error.message;
  }
  return 'Something went wrong. Try again.';
}

export function StepUpDialog({
  open,
  onConfirmed,
  onCancel,
}: {
  open: boolean;
  onConfirmed: () => void;
  onCancel: () => void;
}) {
  const { send } = useAuthentication();
  const [password, setPassword] = useState('');
  const [factor, setFactor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || dialog.open) {
      return;
    }
    dialog.showModal();
    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  async function confirm() {
    setError(null);
    try {
      await send('/api/v1/auth/reauthentication', 'POST', {
        password,
        secondFactor: {
          kind: factor.replace(/-/g, '').length === 32 ? 'RECOVERY' : 'TOTP',
          code: factor,
        },
      });
      onConfirmed();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Confirm your identity"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') {
          return;
        }
        const focusable = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => !element.hasAttribute('disabled'));
        if (focusable.length === 0) {
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <h2>Confirm your identity</h2>
      <p>Enter your password and current authenticator code to continue.</p>
      <label>
        Password
        <input
          aria-label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label>
        Authenticator or recovery code
        <input
          aria-label="Authenticator or recovery code"
          value={factor}
          onChange={(event) => setFactor(event.target.value)}
        />
      </label>
      <button type="button" onClick={confirm}>
        Confirm
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </dialog>
  );
}
