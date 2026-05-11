import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { User } from '../../domain/types';
import { deleteUser, listUsers } from '../../services/supabase/users';
import { toErrorMessage } from '../../lib/errors';
import { Modal } from '../../ui/components/Modal';
import { Spinner } from '../../ui/components/Spinner';
import { Table, type TableColumn } from '../../ui/components/Table';
import {
  ChatIcon,
  EditIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from '../../ui/components/Icon';
import { EmployeeForm } from './EmployeeForm';

type StatusFilter = 'all' | 'active' | 'pending';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending first login' },
];

function isPending(u: User): boolean {
  return u.passwordHash === null || u.passwordHash === '';
}

export default function Employees() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (e) {
      setLoadError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter === 'active' && isPending(u)) return false;
      if (statusFilter === 'pending' && !isPending(u)) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.designation.toLowerCase().includes(q)
      );
    });
  }, [users, search, statusFilter]);

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteUser(deleting.id);
      setDeleting(null);
      await refresh();
    } catch (e) {
      setDeleteError(toErrorMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  const columns: TableColumn<User>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (u) => (
        <div>
          <div className="font-medium text-white">{u.name}</div>
          <div className="font-mono text-xs text-slate-500">@{u.username}</div>
        </div>
      ),
    },
    {
      key: 'designation',
      header: 'Designation',
      cell: (u) => u.designation || <span className="text-slate-600">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '160px',
      cell: (u) => <StatusPill pending={isPending(u)} />,
    },
    {
      key: 'created',
      header: 'Added',
      width: '140px',
      cell: (u) => (
        <span className="font-mono text-xs text-slate-500">
          {new Date(u.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '230px',
      className: 'text-right',
      cell: (u) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => navigate(`/admin/employees/${u.id}/flowchart`)}
            className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-100 transition-colors"
            aria-label={`View ${u.name}'s flowchart`}
            title="View flowchart"
          >
            <ListIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => navigate(`/admin/tasks/new?assigneeId=${u.id}`)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-teal hover:bg-teal/10 border border-teal/20 transition-colors"
          >
            <ChatIcon size={13} />
            Assign task
          </button>
          <button
            type="button"
            className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-100 transition-colors"
            onClick={() => setEditing(u)}
            aria-label={`Edit ${u.name}`}
          >
            <EditIcon size={16} />
          </button>
          <button
            type="button"
            className="p-2 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            onClick={() => {
              setDeleteError(null);
              setDeleting(u);
            }}
            aria-label={`Delete ${u.name}`}
          >
            <TrashIcon size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-10 max-w-6xl mx-auto"
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-mono text-xs text-teal uppercase tracking-wider mb-1">Team</p>
          <h1 className="font-display text-3xl font-semibold text-white">Employees</h1>
        </div>
        <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
          <PlusIcon size={16} />
          Add employee
        </button>
      </div>
      <p className="text-slate-400 text-sm mb-8">
        Manage everyone with FlowDesk access. Lead-ness is decided per-project when you assign work.
      </p>

      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <SearchIcon size={16} />
          </span>
          <input
            type="text"
            className="input-base pl-9"
            placeholder="Search by name, username, designation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 p-1 rounded-xl border border-white/10 bg-navy-900/60">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                statusFilter === f.key
                  ? 'bg-teal/15 text-teal'
                  : 'text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-12 flex items-center justify-center gap-3 text-slate-400">
          <Spinner /> Loading employees…
        </div>
      ) : loadError ? (
        <div className="px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm">
          {loadError}
        </div>
      ) : (
        <Table<User>
          columns={columns}
          rows={filtered}
          rowKey={(u) => u.id}
          emptyState={<EmptyState onAdd={() => setCreateOpen(true)} hasFilters={users.length > 0} />}
        />
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add employee"
        description="Just their profile — they'll set their own password on first login."
        width="lg"
      >
        <EmployeeForm
          mode="create"
          onCancel={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            void refresh();
          }}
        />
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.name ?? ''}`}
        description="Update profile details. Passwords can only be changed by the employee themselves."
        width="lg"
      >
        {editing && (
          <EmployeeForm
            mode="edit"
            initial={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              void refresh();
            }}
          />
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => (deleteBusy ? null : setDeleting(null))}
        title="Delete employee?"
        description={
          deleting
            ? `${deleting.name} will lose access. Their assigned tasks will be deleted too. This cannot be undone.`
            : ''
        }
      >
        {deleteError && (
          <p className="text-sm text-amber-300 mb-3" role="alert">
            {deleteError}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setDeleting(null)}
            disabled={deleteBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteBusy}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 bg-red-500/90 text-white font-semibold transition-colors hover:bg-red-500 active:scale-[0.98] disabled:opacity-50"
          >
            {deleteBusy ? <Spinner /> : <TrashIcon size={16} />}
            Delete
          </button>
        </div>
      </Modal>
    </motion.div>
  );
}

function StatusPill({ pending }: { pending: boolean }) {
  return pending ? (
    <span className="pill border border-amber-500/30 bg-amber-500/10 text-amber-300">
      Pending first login
    </span>
  ) : (
    <span className="pill border border-teal/30 bg-teal/10 text-teal">Active</span>
  );
}

function EmptyState({ onAdd, hasFilters }: { onAdd: () => void; hasFilters: boolean }) {
  return (
    <div className="glass-card p-12 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center text-teal mb-4">
        <UsersIcon size={22} />
      </div>
      <h3 className="font-display text-lg font-semibold text-white mb-1">
        {hasFilters ? 'No matches' : 'No employees yet'}
      </h3>
      <p className="text-sm text-slate-400 mb-5 max-w-sm">
        {hasFilters
          ? 'Try clearing your search or filter.'
          : 'Add your first teammate to start assigning tasks.'}
      </p>
      {!hasFilters && (
        <button type="button" className="btn-primary" onClick={onAdd}>
          <PlusIcon size={16} />
          Add employee
        </button>
      )}
    </div>
  );
}
