import { getCurrentProfile } from "@/lib/get-current-profile";
import { getAnnouncements } from "@/lib/dashboard-queries";
import { AnnouncementsFeed } from "@/components/dashboard/announcements-feed";
import { PostAnnouncementForm } from "@/components/dashboard/post-announcement-form";

export default async function AnnouncementsPage() {
  const current = await getCurrentProfile();
  const canPostCompanyWide = current?.profile.role === "boss_boss" || current?.profile.role === "supervisor";
  const canPost = current?.profile.role !== "employee";
  const items = await getAnnouncements(current?.profile.department_id ?? null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Announcements</h1>
        {canPost && <PostAnnouncementForm canPostCompanyWide={canPostCompanyWide} />}
      </div>
      <AnnouncementsFeed items={items} />
    </div>
  );
}
