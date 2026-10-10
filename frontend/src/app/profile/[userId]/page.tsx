"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Camera, CalendarClock, ExternalLink, GraduationCap, MapPin, MessageCircle, Pencil, Star, UserCheck, UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BookingModal } from "@/components/BookingModal";
import { EmojiPicker } from "@/components/EmojiPicker";
import { PostCard } from "@/components/PostCard";
import { useToast } from "@/components/Toast";
import { Avatar, Button, Card, EmptyState, inputClass, Modal, RoleBadge, Spinner, TierBadge, VerifiedBadge } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { EMPLOYMENT_TYPE_LABEL, formatDay, formatMonthLong, formatTenure, formatTime, fullName, studentLevelLabel } from "@/lib/format";
import { AVATAR_SIZE, BANNER_SIZE, resizeImage } from "@/lib/image";
import { useSession } from "@/lib/session";
import type { Achievements, Post, Profile, Slot } from "@/lib/types";

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-primary">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Square "logo" made from the organisation's initials, like LinkedIn's placeholder. */
function OrgMark({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return <div className="flex size-12 shrink-0 items-center justify-center rounded-control bg-primary-soft text-sm font-black text-primary">{letters}</div>;
}

function MessageRequestModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [body, setBody] = useState(`Hi ${profile.firstName}! `);
  const [isSending, setIsSending] = useState(false);
  const send = async () => {
    setIsSending(true);
    try {
      const { data } = await api.post<{ id: string }>("/conversations", { recipientId: profile.id, body });
      toast(`Message request sent to ${profile.firstName} ✉️`);
      router.push(`/messages/${data.id}`);
    } catch (caught) {
      toast(errorMessage(caught), "error");
      setIsSending(false);
    }
  };
  return (
    <Modal title={`Message ${profile.firstName}`} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">
        This is a message request. {profile.firstName} can accept it to start the conversation. Introduce yourself and say what you&apos;d like help with.
      </p>
      <textarea className={inputClass} rows={5} maxLength={1000} value={body} onChange={(event) => setBody(event.target.value)} />
      <div className="mt-3 flex items-center justify-between">
        <EmojiPicker onPick={(emoji) => setBody((current) => current + emoji)} />
        <Button onClick={send} disabled={body.trim().length < 5} isLoading={isSending}>
          Send request
        </Button>
      </div>
    </Modal>
  );
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: viewer, refreshUser } = useSession();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [achievements, setAchievements] = useState<Achievements | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const isMe = viewer?.id === userId;

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Profile>(`/users/${userId}`);
      setProfile(data);
      // Each section loads independently so one failed request doesn't blank the others.
      api.get<Achievements>(`/users/${userId}/achievements`).then(({ data: result }) => setAchievements(result)).catch(() => {});
      api.get<Post[]>("/posts", { authorId: userId }).then(({ data: result }) => setPosts(result)).catch(() => {});
      if (data.role === "ALUMNI") api.get<Slot[]>(`/users/${userId}/availability-slots`, { isOpen: "true" }).then(({ data: result }) => setSlots(result)).catch(() => {});
    } catch {
      setNotFound(true);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const slotsByDay = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    for (const slot of slots) groups.set(formatDay(slot.startsAt), [...(groups.get(formatDay(slot.startsAt)) ?? []), slot]);
    return [...groups.entries()].slice(0, 5);
  }, [slots]);

  const toggleFollow = async () => {
    if (!profile) return;
    const isFollowing = !profile.isFollowing;
    setProfile({ ...profile, isFollowing, stats: { ...profile.stats, followerCount: profile.stats.followerCount + (isFollowing ? 1 : -1) } });
    await (isFollowing ? api.put(`/users/${profile.id}/follow`) : api.delete(`/users/${profile.id}/follow`)).catch(() => load());
  };

  const uploadImage = (field: "avatarUrl" | "bannerUrl") => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const size = field === "avatarUrl" ? AVATAR_SIZE : BANNER_SIZE;
      const dataUrl = await resizeImage(file, size.width, size.height);
      await api.patch("/users/me", { [field]: dataUrl });
      setProfile((current) => (current ? { ...current, [field]: dataUrl } : current));
      await refreshUser();
      toast(field === "avatarUrl" ? "Profile photo updated 📸" : "Backdrop updated 🎨");
    } catch (caught) {
      toast(errorMessage(caught), "error");
    }
  };

  if (notFound) return <AppShell><EmptyState icon="🤷" title="This profile doesn't exist" /></AppShell>;
  if (!profile) return <AppShell><Spinner /></AppShell>;

  const isAlumni = profile.role === "ALUMNI";
  const canBook = viewer?.role === "STUDENT" && isAlumni;
  const canMessage = viewer && !isMe && (viewer.role !== "STUDENT" || isAlumni);

  return (
    <AppShell wide>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {/* Header: backdrop + photo */}
          <Card className="overflow-hidden">
            <div className="relative">
              {profile.bannerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.bannerUrl} alt="" decoding="async" className="aspect-[4/1] w-full object-cover" />
              ) : (
                <div className="banner-default aspect-[4/1] w-full" />
              )}
              {isMe && (
                <label aria-label="Edit backdrop" className="tap-target absolute right-3 top-3 flex cursor-pointer items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 text-xs font-semibold shadow hover:bg-surface">
                  <Camera className="size-4" /> <span className="hidden sm:inline">Edit backdrop</span>
                  <input type="file" accept="image/*" className="hidden" onChange={uploadImage("bannerUrl")} />
                </label>
              )}
            </div>
            <div className="px-4 pb-5 sm:px-5">
              {/* Avatar size is fluid; pulling it up by half its size keeps it centred on the banner edge. */}
              <div className="-mt-[clamp(2.75rem,11vw,4.25rem)] flex items-end justify-between gap-2">
                <div className="relative">
                  <Avatar user={profile} size="clamp(5.5rem, 22vw, 8.5rem)" className="border-4 border-surface" />
                  {isMe && (
                    <label className="absolute bottom-2 right-2 flex size-9 cursor-pointer items-center justify-center rounded-full border-2 border-surface bg-primary text-on-primary shadow hover:bg-primary-hover" title="Change photo">
                      <Camera className="size-4" />
                      <input type="file" accept="image/*" className="hidden" onChange={uploadImage("avatarUrl")} />
                    </label>
                  )}
                </div>
                {isMe && (
                  <Link href="/settings" className="mb-2 flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted">
                    <Pencil className="size-3.5" /> Edit profile
                  </Link>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <h1 className="text-title font-extrabold text-ink">{fullName(profile)}</h1>
                {profile.isVerified && <VerifiedBadge />}
                <RoleBadge role={profile.role} />
                <TierBadge tier={profile.tier} size="md" />
              </div>
              <p className="mt-1 text-[15px]">
                {isAlumni && profile.jobTitle ? `${profile.jobTitle} at ${profile.company}` : `${studentLevelLabel(profile.studentLevel)} ${profile.department.name} student`}
                {profile.headline && <span className="text-muted"> · {profile.headline}</span>}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span className="flex items-center gap-1">
                  <GraduationCap className="size-4" /> {profile.department.name}, {isAlumni ? `Class of ${profile.graduationYear}` : `graduating ${profile.graduationYear}`}
                </span>
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-4" /> {profile.location}
                  </span>
                )}
                {profile.linkedinUrl && (
                  <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-primary hover:underline">
                    LinkedIn <ExternalLink className="size-3" />
                  </a>
                )}
              </p>
              <p className="mt-2 text-sm">
                <span className="font-semibold text-primary">{profile.stats.followerCount}</span> <span className="text-muted">followers</span>
                {isAlumni && (
                  <>
                    {" · "}
                    <span className="font-semibold text-primary">{profile.stats.sessionsCompletedCount}</span> <span className="text-muted">sessions</span>
                    {profile.stats.averageRating && (
                      <>
                        {" · "}
                        <Star className="inline size-3.5 fill-primary text-primary" /> <span className="font-semibold">{profile.stats.averageRating.toFixed(1)}</span>{" "}
                        <span className="text-muted">({profile.stats.ratingCount})</span>
                      </>
                    )}
                  </>
                )}
              </p>

              {!isMe && viewer && (
                <div className="mt-4 flex flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
                  {canBook && (
                    <Button variant="accent" onClick={() => setBookingSlotId(slots[0]?.id ?? "")} disabled={slots.length === 0}>
                      <CalendarClock className="size-4" /> {slots.length ? "Book a session" : "No open slots"}
                    </Button>
                  )}
                  {canMessage && (
                    <Button variant="primary" onClick={() => setIsMessageOpen(true)}>
                      <MessageCircle className="size-4" /> Message
                    </Button>
                  )}
                  <Button variant="secondary" onClick={toggleFollow}>
                    {profile.isFollowing ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
                    {profile.isFollowing ? "Following" : "Follow"}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {profile.bio && (
            <Section title="About">
              <p className="measure whitespace-pre-wrap text-sm leading-relaxed">{profile.bio}</p>
            </Section>
          )}

          <Section title="Experience" action={isMe && <Link href="/settings#experience" className="text-muted hover:text-primary"><Pencil className="size-4" /></Link>}>
            {profile.experiences.length === 0 ? (
              <p className="text-sm text-muted">{isMe ? "Add your work history so students can see your path." : "No experience added yet."}</p>
            ) : (
              <ol className="space-y-5">
                {profile.experiences.map((experience) => (
                  <li key={experience.id} className="flex gap-3">
                    <OrgMark name={experience.company} />
                    <div className="min-w-0 flex-1 border-b border-line pb-5 last:border-0">
                      <p className="flex items-center gap-2 font-semibold">
                        {experience.title}
                        {!experience.endDate && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">Current</span>}
                      </p>
                      <p className="text-sm">
                        {experience.company} · {EMPLOYMENT_TYPE_LABEL[experience.employmentType]}
                      </p>
                      <p className="text-xs text-muted">{formatTenure(experience.startDate, experience.endDate)}</p>
                      {experience.location && <p className="text-xs text-muted">{experience.location}</p>}
                      {experience.description && <p className="mt-2 whitespace-pre-wrap text-sm">{experience.description}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="Education" action={isMe && <Link href="/settings#education" className="text-muted hover:text-primary"><Pencil className="size-4" /></Link>}>
            <ol className="space-y-4">
              {profile.educations.map((education) => (
                <li key={education.id} className="flex gap-3">
                  <OrgMark name={education.school} />
                  <div>
                    <p className="font-semibold">{education.school}</p>
                    <p className="text-sm">{[education.degree, education.fieldOfStudy].filter(Boolean).join(", ")}</p>
                    <p className="text-xs text-muted">
                      {education.startYear} – {education.endYear ?? "Present"}
                      {education.endYear && education.endYear > new Date().getFullYear() && " (expected)"}
                    </p>
                    {education.description && <p className="mt-1 text-sm">{education.description}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {profile.skills.length > 0 && (
            <Section title="Skills">
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-line px-3 py-1 text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {isAlumni && (
            <Section title="Posts">
              {posts.length === 0 ? (
                <p className="text-sm text-muted">No posts yet.</p>
              ) : (
                <div className="space-y-4">
                  {posts.slice(0, 3).map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </Section>
          )}
        </div>

        <aside className="space-y-4">
          {isAlumni && (
            <Card className="p-5">
              <p className="mb-1 flex items-center gap-1.5 font-bold text-primary">
                <CalendarClock className="size-4" /> Open slots
              </p>
              <p className="mb-4 text-xs text-muted">30-minute sessions · times in WAT</p>
              {slotsByDay.length === 0 ? (
                <p className="text-sm text-muted">No open slots right now. Check back soon.</p>
              ) : (
                <div className="space-y-3">
                  {slotsByDay.map(([day, daySlots]) => (
                    <div key={day}>
                      <p className="mb-1.5 text-xs font-semibold">{day}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {daySlots.map((slot) => (
                          <button
                            key={slot.id}
                            disabled={!canBook}
                            onClick={() => setBookingSlotId(slot.id)}
                            className="rounded-control border border-line px-2.5 py-1 text-xs font-semibold coarse:min-h-11 coarse:px-3.5 enabled:hover:border-primary enabled:hover:bg-primary-soft disabled:cursor-default"
                          >
                            {formatTime(slot.startsAt)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {isMe && (
                <Link href="/availability" className="mt-4 block text-center text-xs font-semibold text-primary hover:underline">
                  Manage availability
                </Link>
              )}
            </Card>
          )}

          {achievements && (
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold text-primary">Badges</p>
                <span className="text-xs text-muted">{achievements.points.toLocaleString()} pts</span>
              </div>
              {achievements.badges.length === 0 ? (
                <p className="text-sm text-muted">No badges yet.</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,4.5rem),1fr))] gap-2">
                  {achievements.badges.map((badge) => (
                    <div key={badge.id} title={`${badge.name}: ${badge.description}`} className="flex flex-col items-center rounded-control bg-surface-muted p-2 text-center">
                      <span className="text-2xl leading-none" aria-hidden="true">{badge.icon}</span>
                      <span className="mt-1 line-clamp-2 text-[10px] leading-tight text-muted">{badge.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {achievements && achievements.awards.length > 0 && (
            <Card className="p-5">
              <p className="mb-3 font-bold text-primary">🏆 Awards</p>
              <ul className="space-y-2">
                {achievements.awards.slice(0, 6).map((award) => (
                  <li key={award.id} className="text-sm">
                    <p className="font-semibold">{award.type.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())}</p>
                    <p className="text-xs text-muted">
                      {award.type.endsWith("YEAR") ? new Date(award.periodStart).getUTCFullYear() : formatMonthLong(award.periodStart)}
                      {award.department && ` · ${award.department.name}`}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {isMe && (
            <Card className="p-5 text-sm">
              <p className="mb-1 flex items-center gap-1.5 font-bold text-primary">
                <Briefcase className="size-4" /> Tip
              </p>
              <p className="text-muted">A complete profile (photo, headline, about, skills{isAlumni ? ", current role" : ""}) earns you 25 points.</p>
            </Card>
          )}
        </aside>
      </div>

      {bookingSlotId !== null && (
        <BookingModal
          alumnus={profile}
          slots={slots}
          initialSlotId={bookingSlotId || undefined}
          onClose={() => setBookingSlotId(null)}
          onBooked={(booking) => {
            setBookingSlotId(null);
            setSlots((current) => current.filter((slot) => slot.id !== booking.slot.id));
          }}
        />
      )}
      {isMessageOpen && <MessageRequestModal profile={profile} onClose={() => setIsMessageOpen(false)} />}
    </AppShell>
  );
}
