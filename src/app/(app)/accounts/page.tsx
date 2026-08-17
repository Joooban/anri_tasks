import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getDepartments, getProfiles, getTaskTypes } from "@/lib/queries";
import { getAdminRoles, getPendingApprovalRequests, getAdminAuditLog } from "@/lib/admin-queries";
import { getMyPermissions, hasAnyPermission } from "@/lib/get-permissions";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { AccountsTable } from "@/components/accounts/accounts-table";
import { AllowedEmails, type AllowedEmailItem } from "@/components/accounts/allowed-emails";
import { TaskTypesManager } from "@/components/accounts/task-types-manager";
import { AdminRolesManager } from "@/components/accounts/admin-roles-manager";
import { PendingApprovals } from "@/components/accounts/pending-approvals";
import { AdminActivityTrail } from "@/components/accounts/admin-activity-trail";

export default async function AccountsPage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");

  const permissions = await getMyPermissions();
  if (!hasAnyPermission(permissions)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [profiles, departments, taskTypes, { data: allowedEmails }, adminRoles, pendingRequests, auditLog] =
    await Promise.all([
      getProfiles(),
      getDepartments(),
      getTaskTypes(),
      supabase.rpc("list_allowed_emails_rpc"),
      getAdminRoles(),
      getPendingApprovalRequests(),
      getAdminAuditLog(),
    ]);

  const pendingProfileIds = new Set(pendingRequests.map((r) => r.target_profile_id));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Accounts</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Assign role and department for anyone who has signed in. New sign-ins start as an
          unassigned Employee until you set them up here.
        </p>
      </div>

      {permissions.has("approve_admin_requests") && <PendingApprovals items={pendingRequests} />}
      {permissions.has("manage_allowlist") && <AllowedEmails items={(allowedEmails ?? []) as AllowedEmailItem[]} />}
      {permissions.has("manage_task_types") && <TaskTypesManager items={taskTypes} />}
      {permissions.has("manage_roles") && <AdminRolesManager roles={adminRoles} />}
      {permissions.has("manage_accounts") && (
        <AccountsTable
          profiles={profiles}
          departments={departments}
          myProfileId={current.profile.id}
          adminRoles={adminRoles}
          pendingProfileIds={pendingProfileIds}
          auditLog={auditLog}
        />
      )}
      <Card>
        <CardTitle className="mb-3">Admin activity trail</CardTitle>
        <AdminActivityTrail items={auditLog} />
      </Card>
    </div>
  );
}
