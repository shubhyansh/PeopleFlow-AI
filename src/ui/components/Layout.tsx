import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../auth/AuthContext';
import {
  ChevronLeftIcon,
  FolderIcon,
  HomeIcon,
  ListIcon,
  LogOutIcon,
  UsersIcon,
} from './Icon';
import { SparkleIcon } from './IconExtras';
import { listLeadProjects } from '../../services/supabase/projects';
import type { Project } from '../../domain/types';

export function EmployeeLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { flowdeskUser, signOut } = useAuth();
  const [leadProjects, setLeadProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!flowdeskUser) return;
    let cancelled = false;
    (async () => {
      try {
        const projects = await listLeadProjects(flowdeskUser.id);
        if (!cancelled) setLeadProjects(projects);
      } catch {
        // Silent fail — Lead menu just stays hidden if the lookup errors.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flowdeskUser]);

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="shrink-0 px-6 py-3 flex items-center justify-between border-b border-white/5 bg-navy-900/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-teal shadow-teal-glow" />
          <span className="font-mono text-xs text-teal tracking-wider uppercase">FlowDesk</span>
          <span className="text-slate-700">·</span>
          <span className="text-sm text-slate-300">{flowdeskUser?.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {leadProjects.length > 0 && <LeadMenu projects={leadProjects} />}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
          >
            <LogOutIcon size={16} />
            Sign out
          </button>
        </div>
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function LeadMenu({ projects }: { projects: Project[] }) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Capture the trigger's screen position so the portaled menu can align under it.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (buttonRef.current) setAnchorRect(buttonRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-teal border border-teal/30 bg-teal/5 hover:bg-teal/10 transition-colors"
      >
        <SparkleIcon size={14} />
        Lead
        <span className="font-mono text-[10px] text-teal/70">{projects.length}</span>
      </button>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && anchorRect && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                /* Portal escapes any local stacking context — z-[60] sits above
                 * React Flow internals. Position is computed from the trigger's
                 * client rect so the menu lines up under the button. */
                style={{
                  position: 'fixed',
                  top: anchorRect.bottom + 8,
                  right: Math.max(8, window.innerWidth - anchorRect.right),
                }}
                className="z-[60] min-w-[260px] glass-card p-2"
              >
                <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                  Projects you lead
                </div>
                {projects.map((p) => (
                  <NavLink
                    key={p.id}
                    to={`/employee/projects/${p.id}`}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      [
                        'block px-3 py-2 rounded-lg text-sm transition-colors',
                        isActive
                          ? 'bg-teal/10 text-teal'
                          : 'text-slate-200 hover:bg-white/5 hover:text-white',
                      ].join(' ')
                    }
                  >
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="font-mono text-[10px] text-slate-500">
                      {p.memberIds.length} member{p.memberIds.length === 1 ? '' : 's'}
                    </div>
                  </NavLink>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: typeof UsersIcon;
  disabled?: boolean;
}

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: HomeIcon },
  { to: '/admin/employees', label: 'Employees', icon: UsersIcon },
  { to: '/admin/tasks', label: 'Tasks', icon: ListIcon },
  { to: '/admin/projects', label: 'Projects', icon: FolderIcon },
  { to: '/admin/org', label: 'Org view', icon: SparkleIcon },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { flowdeskUser, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen flex">
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="surface border-r border-white/5 flex flex-col"
      >
        <div className="px-4 py-5 flex items-center gap-2 border-b border-white/5">
          <div className="w-2 h-2 rounded-full bg-teal shadow-teal-glow shrink-0" />
          {!collapsed && (
            <span className="font-mono text-xs text-teal tracking-wider uppercase">FlowDesk</span>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                    isActive
                      ? 'bg-teal/10 text-teal border border-teal/20'
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent',
                    item.disabled ? 'opacity-40 pointer-events-none' : '',
                    collapsed ? 'justify-center' : '',
                  ].join(' ')
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} />
                {!collapsed && (
                  <span className="flex-1">
                    {item.label}
                    {item.disabled && (
                      <span className="ml-2 font-mono text-[10px] text-slate-600">soon</span>
                    )}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-white/5 space-y-1">
          {!collapsed && (
            <div className="px-3 py-2">
              <p className="text-xs text-slate-500">Signed in as</p>
              <p className="text-sm text-slate-200 font-medium truncate">{flowdeskUser?.name}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className={[
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm',
              'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 transition-colors',
              collapsed ? 'justify-center' : '',
            ].join(' ')}
            title={collapsed ? 'Sign out' : undefined}
          >
            <LogOutIcon size={18} />
            {!collapsed && <span>Sign out</span>}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className={[
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm',
              'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300 transition-colors',
              collapsed ? 'justify-center' : '',
            ].join(' ')}
            title={collapsed ? 'Expand' : undefined}
          >
            <motion.span
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="inline-flex"
            >
              <ChevronLeftIcon size={18} />
            </motion.span>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </motion.aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
