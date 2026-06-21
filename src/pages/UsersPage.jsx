import { UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { inviteUser, listUsers } from '../utils/accountingApi';

const emptyForm = {
  email: '',
  displayName: '',
  password: '',
  role: 'accountant',
};

export default function UsersPage() {
  const { session, isOwner } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadUsers = useCallback(async () => {
    if (!session?.access_token || !isOwner) {
      return;
    }

    setLoading(true);

    try {
      const result = await listUsers(session.access_token);
      setUsers(result.users || []);
    } catch (error) {
      setErrorMessage(error.message || 'Could not load users.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, isOwner]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function handleInvite(event) {
    event.preventDefault();

    if (!session?.access_token) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    try {
      await inviteUser(session.access_token, form);
      setShowModal(false);
      setForm(emptyForm);
      setSuccessMessage(`Access created for ${form.email}. Share the password securely.`);
      await loadUsers();
    } catch (error) {
      setErrorMessage(error.message || 'Could not invite user.');
    }
  }

  if (!isOwner) {
    return <div className="accounting-error-banner">Only the owner can manage people.</div>;
  }

  return (
    <div className="accounting-page">
      <header className="accounting-page-header">
        <div>
          <span className="accounting-kicker">People</span>
          <h1>Accounting access</h1>
          <p>Invite your accountant or team with their own login — separate from workshop staff.</p>
        </div>

        <div className="accounting-header-actions">
          <button className="primary-action" type="button" onClick={() => setShowModal(true)}>
            <UserPlus size={16} />
            Add person
          </button>
        </div>
      </header>

      {successMessage ? <div className="accounting-success-banner">{successMessage}</div> : null}
      {errorMessage ? <div className="accounting-error-banner">{errorMessage}</div> : null}

      <section className="accounting-table-card">
        <table className="accounting-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>Loading people...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4}>No users yet.</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.display_name || '—'}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className="role-pill">{user.role}</span>
                  </td>
                  <td>{user.active ? 'Active' : 'Inactive'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {showModal ? (
        <div className="accounting-modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="accounting-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleInvite}
          >
            <header>
              <h2>Add person</h2>
              <p>Create a login for your accountant. They will not use workshop COSA Core emails.</p>
            </header>

            <label>
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
            <label>
              Display name
              <input
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              />
            </label>
            <label>
              Temporary password
              <input
                required
                minLength={8}
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </label>
            <label>
              Role
              <select
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
              >
                <option value="accountant">Accountant (can edit)</option>
                <option value="viewer">Viewer (read only)</option>
                <option value="owner">Owner</option>
              </select>
            </label>

            <div className="accounting-modal-actions">
              <button className="secondary-action" type="button" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="primary-action" type="submit">
                Create access
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
