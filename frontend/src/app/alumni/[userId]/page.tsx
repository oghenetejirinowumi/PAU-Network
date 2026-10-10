import { redirect } from "next/navigation";

export default async function AlumniProfileRedirect({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  redirect(`/profile/${userId}`);
}
