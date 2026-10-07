import { useEffect, useState } from 'react';
import { fetchWorkspaceMembers, updateMemberRole, supabase } from '../lib/services';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, Dialog, Field, Input, Select, PageHeader, Badge, Empty, IconButton, StatCard } from '../components/ui';
import { ShieldCheck, UserCog, Trash2, UserPlus } from 'lucide-react';

export default function UserManagement() {
  const { profile } = useAuth();
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', role: 'user' });
  const [addMsg, setAddMsg] = useState('');

  const isAdmin = profile?.workspace_members?.some((m) => m.role === 'admin') || profile?.role === 'admin';

  const load = () => fetchWorkspaceMembers().then(setMembers).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const changeRole = async (memberId, role) => {
    try {
      await updateMemberRole(memberId, role);
      load();
    } catch (e) { setError(e.message); }
  };

  const removeMember = async (memberId) => {
    if (!confirm('Remove this member from the workspace?')) return;
    try {
      const { error: err } = await supabase.rpc('remove_workspace_member', { p_member_id: memberId });
      if (err) throw err;
      load();
    } catch (e) { setError(e.message); }
  };

  const addMember = async (e) => {
    e.preventDefault();
    setAddMsg('');
    try {
      const { error: err } = await supabase.rpc('add_workspace_member', {
        p_email: addForm.email,
        p_role: addForm.role,
      });
      if (err) throw err;
      setAdding(false);
      setAddForm({ email: '', role: 'user' });
      load();
    } catch (e) { setAddMsg(e.message); }
  };

  if (!isAdmin) {
    return (
      <div>
        <PageHeader label="System" title="User Management" />
        <Card><Empty title="Admin access required">You need admin permission to manage users.</Empty></Card>
      </div>
    );
  }

  const admins = members.filter((m) => m.role === 'admin').length;
  const users = members.filter((m) => m.role === 'user').length;

  return (
    <div>
      <PageHeader
        label="System"
        title="User Management"
        description="Manage workspace members, roles and permissions. New users must sign up first before you can add them."
        actions={
          <Button onClick={() => { setAdding(true); setAddMsg(''); }}><UserPlus size={15} /> Add member</Button>
        }
      />
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total members" value={members.length} accent="copper" />
        <StatCard label="Admins" value={admins} accent="teal" />
        <StatCard label="Users" value={users} accent="ink" />
        <StatCard label="Your role" value={isAdmin ? 'Admin' : 'User'} accent="copper" />
      </div>

      <Card title="Workspace members">
        {members.length === 0 ? <Empty>No members yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th></th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="font-semibold">{m.profile?.name || '—'}</td>
                    <td className="num text-mutedfg">{m.profile?.email || '—'}</td>
                    <td>
                      <Select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} className="!h-8 !w-32 !text-xs">
                        <option value="admin">admin</option>
                        <option value="user">user</option>
                      </Select>
                    </td>
                    <td className="num text-mutedfg">{new Date(m.created_at).toLocaleDateString('en-GB')}</td>
                    <td>
                      {members.length > 1 && (
                        <IconButton onClick={() => removeMember(m.id)}><Trash2 size={14} /></IconButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {adding && (
        <Dialog title="Add workspace member" onClose={() => setAdding(false)}>
          <form onSubmit={addMember} className="p-5">
            <p className="mb-3 text-[12px] text-mutedfg">
              The user must have already signed up with this email. Enter their email and assign a role.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email *" className="col-span-2"><Input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} required placeholder="user@factory.pk" /></Field>
              <Field label="Role">
                <Select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </Select>
              </Field>
            </div>
            {addMsg && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{addMsg}</div>}
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
              <Button type="submit"><UserPlus size={15} /> Add</Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
