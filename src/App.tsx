import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './routes/Login';
import AdminDashboard from './routes/AdminDashboard';
import Employees from './routes/admin/Employees';
import AllTasks from './routes/admin/AllTasks';
import NewTask from './routes/admin/NewTask';
import EmployeeFlowchart from './routes/admin/EmployeeFlowchart';
import Org from './routes/admin/Org';
import Projects from './routes/admin/Projects';
import Flowchart from './routes/employee/Flowchart';
import ProjectLeadView from './routes/employee/ProjectLeadView';
import { RequireRole } from './auth/AuthContext';
import { AdminLayout, EmployeeLayout } from './ui/components/Layout';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* New task is full-screen — render outside the AdminLayout */}
      <Route
        path="/admin/tasks/new"
        element={
          <RequireRole allowed={['admin']}>
            <NewTask />
          </RequireRole>
        }
      />

      {/* Per-employee flowchart is also full-screen (canvas needs the room) */}
      <Route
        path="/admin/employees/:id/flowchart"
        element={
          <RequireRole allowed={['admin']}>
            <EmployeeFlowchart />
          </RequireRole>
        }
      />

      <Route
        path="/admin/*"
        element={
          <RequireRole allowed={['admin']}>
            <AdminLayout>
              <Routes>
                <Route index element={<AdminDashboard />} />
                <Route path="employees" element={<Employees />} />
                <Route path="tasks" element={<AllTasks />} />
                <Route path="projects" element={<Projects />} />
                <Route path="org" element={<Org />} />
                <Route path="*" element={<Navigate to="" replace />} />
              </Routes>
            </AdminLayout>
          </RequireRole>
        }
      />

      <Route
        path="/employee"
        element={
          <RequireRole allowed={['employee']}>
            <EmployeeLayout>
              <Flowchart />
            </EmployeeLayout>
          </RequireRole>
        }
      />

      <Route
        path="/employee/projects/:id"
        element={
          <RequireRole allowed={['employee']}>
            <EmployeeLayout>
              <ProjectLeadView />
            </EmployeeLayout>
          </RequireRole>
        }
      />

      {/* Lead-mode task creation — full-screen, same component as admin /admin/tasks/new */}
      <Route
        path="/employee/projects/:id/assign"
        element={
          <RequireRole allowed={['employee']}>
            <NewTask />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
