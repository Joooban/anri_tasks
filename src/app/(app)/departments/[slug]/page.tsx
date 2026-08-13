import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getDepartments } from "@/lib/queries";
import { DepartmentDashboard } from "@/components/dashboard/department-dashboard";

export default async function DepartmentDrilldownPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const current = await getCurrentProfile();
  if (!current) redirect("/login");
  if (current.profile.role !== "boss_boss" && current.profile.role !== "supervisor") {
    redirect("/dashboard");
  }

  const departments = await getDepartments();
  const department = departments.find((d) => d.slug === slug);
  if (!department) notFound();

  return <DepartmentDashboard departmentId={department.id} departmentName={department.name} />;
}
